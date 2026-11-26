import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { expect, test, type Download, type Page } from './fixtures';

const DEMO_PASSWORD = 'Guigui@2026!';
const BUSINESS_EMAIL = 'empresa.teste@guigui.com';

async function signIn(page: Page, email: string): Promise<Record<string, unknown>> {
  const response = await page.request.post('/api/auth/login', { data: { email, password: DEMO_PASSWORD } });
  expect(response.ok(), await response.text()).toBeTruthy();
  const payload = await response.json();
  await page.addInitScript((account) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);
  return payload.user as Record<string, unknown>;
}

async function openExportHub(page: Page) {
  await signIn(page, BUSINESS_EMAIL);
  await page.goto('/');
  await expect(page.getByTitle('Sessão Iniciada')).toBeVisible({ timeout: 30_000 });
  await page.getByTitle('Sessão Iniciada').click();
  await page.getByRole('button', { name: /Área da Minha Empresa/ }).first().click();
  await expect(page.locator('.guigui-profile-dashboard')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Relatórios', exact: true }).first().click();
  await page.getByRole('button', { name: 'Exportação de dados' }).click();
  await expect(page.getByTestId('prepare-export')).toBeVisible({ timeout: 20_000 });
}

async function downloadedText(download: Download): Promise<string> {
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  return readFileSync(filePath!, 'utf8');
}

/** Lê uma entrada de um ficheiro ZIP (XLSX) sem dependências externas. */
function readZipEntry(buffer: Buffer, entryName: string): string | null {
  const endSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const eocdOffset = buffer.lastIndexOf(endSignature);
  expect(eocdOffset, 'não foi possível encontrar o fim do ZIP').toBeGreaterThanOrEqual(0);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let cursor = buffer.readUInt32LE(eocdOffset + 16);

  for (let index = 0; index < totalEntries; index += 1) {
    expect(buffer.readUInt32LE(cursor)).toBe(0x02014b50);
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');

    if (name === entryName) {
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const data = buffer.subarray(dataStart, dataStart + compressedSize);
      return (method === 0 ? data : inflateRawSync(data)).toString('utf8');
    }

    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

function sheetNamesFromWorkbook(buffer: Buffer): string[] {
  const workbookXml = readZipEntry(buffer, 'xl/workbook.xml');
  expect(workbookXml, 'xl/workbook.xml ausente do ficheiro Excel').toBeTruthy();
  return [...workbookXml!.matchAll(/<sheet[^>]*name="([^"]+)"/g)].map((match) => match[1]);
}

function previewRecordCount(text: string): number {
  const match = text.match(/(\d+)\s+registo\(s\)/);
  expect(match, `não foi possível ler a quantidade em: ${text}`).toBeTruthy();
  return Number(match![1]);
}

test.describe('Exportação guiada', () => {
  test.setTimeout(240_000);

  test('ecrã principal mostra totais e abre o formulário único', async ({ page }) => {
    await openExportHub(page);

    await expect(page.getByTestId('export-total-reports')).toContainText('24');
    await expect(page.getByTestId('export-total-records')).toContainText('Registos disponíveis');
    await expect(page.getByTestId('report-overview')).toContainText('Vendas e clientes');
    await expect(page.locator('#export-history')).toBeVisible();

    await page.getByTestId('prepare-export').click();
    await expect(page.getByTestId('export-wizard')).toBeVisible();
    await expect(page.getByTestId('wizard-step-1')).toBeVisible();

    // A lista de relatórios depende da área escolhida.
    await page.getByTestId('wizard-area').selectOption('sales');
    await expect(page.getByTestId('wizard-report-orders')).toBeVisible();
    await expect(page.getByTestId('wizard-report-customers')).toBeVisible();
    await expect(page.getByTestId('wizard-report-campaigns')).toBeHidden();

    await page.getByTestId('wizard-area').selectOption('marketing');
    await expect(page.getByTestId('wizard-report-campaigns')).toBeVisible();
    await expect(page.getByTestId('wizard-report-orders')).toBeHidden();

    // Sem relatório escolhido não é possível gerar o ficheiro.
    await expect(page.getByTestId('generate-export')).toBeDisabled();
    await page.getByTestId('wizard-report-campaigns').check();
    await expect(page.getByTestId('generate-export')).toBeEnabled();
  });

  test('pesquisa vazia e preenchida alteram efectivamente o CSV exportado', async ({ page }) => {
    await openExportHub(page);
    await page.getByTestId('prepare-export').click();
    await page.getByTestId('wizard-area').selectOption('sales');
    await page.getByTestId('wizard-report-orders').check();

    await page.getByTestId('wizard-period-all').click();

    // Filtro textual que não corresponde a nenhum pedido.
    await page.getByTestId('wizard-query').fill('zzz-sem-qualquer-registo-2026');
    await page.getByTestId('wizard-format-csv').click();

    const previewText = await page.getByTestId('preview-records').innerText();
    const filteredRecords = previewRecordCount(previewText);
    expect(filteredRecords).toBe(0);
    await expect(page.getByTestId('preview-company')).not.toBeEmpty();

    const filteredDownload = page.waitForEvent('download');
    await page.getByTestId('generate-export').click();
    const emptyCsv = await downloadedText(await filteredDownload);
    expect(emptyCsv).toContain('Código');
    const emptyDataRows = emptyCsv.replace(/^\uFEFF/, '').split('\r\n').filter((line) => line.trim().length > 0).length;
    expect(emptyDataRows, 'CSV filtrado não deve conter linhas de dados').toBe(1);
    await expect(page.getByTestId('export-confirmation')).toBeVisible();

    // Sem pesquisa, o mesmo relatório exporta os registos reais.
    await page.getByTestId('prepare-export').click();
    await expect(page.getByTestId('wizard-step-1')).toBeVisible();
    await page.getByTestId('wizard-period-all').click();
    await page.getByTestId('wizard-query').fill('');
    await expect(page.getByTestId('wizard-filter-summary')).toContainText('Sem filtros adicionais');
    await page.getByTestId('wizard-format-csv').click();

    const fullRecords = previewRecordCount(await page.getByTestId('preview-records').innerText());
    expect(fullRecords).toBeGreaterThan(0);
    const fullDownload = page.waitForEvent('download');
    await page.getByTestId('generate-export').click();
    const csv = await downloadedText(await fullDownload);
    const dataRows = csv.replace(/^\uFEFF/, '').split('\r\n').filter((line) => line.trim().length > 0).length - 1;
    expect(dataRows).toBe(fullRecords);
  });

  test('filtro de estado reduz o CSV ao estado escolhido', async ({ page }) => {
    await openExportHub(page);
    await page.getByTestId('prepare-export').click();
    await page.getByTestId('wizard-area').selectOption('sales');
    await page.getByTestId('wizard-report-orders').check();
    await page.getByTestId('wizard-period-all').click();

    // Só os filtros relevantes para pedidos estão visíveis.
    await expect(page.getByTestId('wizard-filter-orderStatus')).toBeVisible();
    await expect(page.getByTestId('wizard-filter-orderType')).toBeVisible();
    await expect(page.getByTestId('wizard-filter-supportStatus')).toBeHidden();

    const options = await page.getByTestId('wizard-filter-orderStatus').locator('option').evaluateAll(
      (nodes) => nodes.map((node) => (node as HTMLOptionElement).value).filter((value) => value !== 'all'),
    );
    expect(options.length).toBeGreaterThan(0);
    const chosenStatus = options[0];
    await page.getByTestId('wizard-filter-orderStatus').selectOption(chosenStatus);
    await page.getByTestId('wizard-format-csv').click();

    const expectedRows = previewRecordCount(await page.getByTestId('preview-records').innerText());
    const download = page.waitForEvent('download');
    await page.getByTestId('generate-export').click();
    const csv = await downloadedText(await download);
    const lines = csv.replace(/^\uFEFF/, '').split('\r\n').filter((line) => line.trim().length > 0);
    expect(lines.length - 1).toBe(expectedRows);

    const headers = lines[0].split(';').map((cell) => cell.replace(/"/g, ''));
    const statusColumn = headers.findIndex((header) => /status|estado/i.test(header));
    expect(statusColumn).toBeGreaterThanOrEqual(0);
    const exportedStatuses = lines.slice(1).map((line) => line.split(';')[statusColumn]?.replace(/"/g, ''));
    if (expectedRows > 0) {
      const normalized = new Set(exportedStatuses.map((status) => String(status).toLowerCase()));
      expect(normalized).toEqual(new Set([chosenStatus.toLowerCase()]));
    } else {
      expect(exportedStatuses).toHaveLength(0);
    }
  });

  test('exportação múltipla gera um Excel único com uma folha por relatório', async ({ page }) => {
    await openExportHub(page);
    await page.getByTestId('prepare-export').click();
    await page.getByTestId('wizard-area').selectOption('sales');
    await page.getByTestId('wizard-report-orders').check();
    await page.getByTestId('wizard-report-customers').check();
    await page.getByTestId('wizard-period-all').click();

    await page.getByTestId('wizard-format-excel').click();
    await expect(page.getByTestId('preview-records')).toContainText('2 relatório(s)');
    await expect(page.getByTestId('preview-format')).toContainText('2 folhas');

    const download = page.waitForEvent('download');
    await page.getByTestId('generate-export').click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^Guigui_Exportacao_.*\.xlsx$/);
    const filePath = await file.path();
    const buffer = readFileSync(filePath!);
    expect(buffer.subarray(0, 2).toString()).toBe('PK');

    const sheets = sheetNamesFromWorkbook(buffer);
    expect(sheets).toHaveLength(2);
    expect(sheets).toContain('Clientes');
    expect(new Set(sheets.map((name) => name.toLowerCase())).size).toBe(2);
    expect(readZipEntry(buffer, 'xl/worksheets/sheet1.xml')).toBeTruthy();
    expect(readZipEntry(buffer, 'xl/worksheets/sheet2.xml')).toBeTruthy();
  });

  test('pré-visualização resume a seleção num único ecrã e o PDF contém os dados', async ({ page }) => {
    await openExportHub(page);
    await page.getByTestId('prepare-export').click();
    await page.getByTestId('wizard-area').selectOption('content');
    await page.getByTestId('wizard-report-events').check();

    await page.getByTestId('wizard-period-custom').click();
    await expect(page.getByTestId('wizard-date-from')).toBeVisible();
    await page.getByTestId('wizard-date-from').fill('2020-01-01');
    await page.getByTestId('wizard-date-to').fill('2030-12-31');

    await page.getByTestId('wizard-format-pdf').click();

    await expect(page.getByTestId('preview-company')).not.toBeEmpty();
    await expect(page.getByTestId('preview-reports')).toContainText('Eventos');
    await expect(page.getByTestId('preview-period')).toContainText('Período personalizado (2020-01-01 a 2030-12-31)');
    await expect(page.getByTestId('preview-format')).toContainText('PDF');
    await expect(page.getByTestId('preview-filters')).toContainText('Sem filtros adicionais');

    // Todas as secções estão no mesmo ecrã: não há passos a percorrer.
    for (const step of ['wizard-step-1', 'wizard-step-2', 'wizard-step-3', 'wizard-step-4', 'wizard-step-5']) {
      await expect(page.getByTestId(step)).toBeVisible();
    }
    await expect(page.getByTestId('wizard-summary')).toContainText('PDF');

    const popupPromise = page.waitForEvent('popup');
    await page.getByTestId('generate-export').click();
    const popup = await popupPromise;
    const content = await popup.content();
    expect(content).toContain('Guigui.com');
    expect(content).toMatch(/Eventos/);
    expect(content).toContain('2020-01-01');
    await popup.close();
  });

  test('exportação individual continua disponível e fica registada no histórico', async ({ page }) => {
    await openExportHub(page);
    const historyBefore = await page.getByTestId('export-history-table').locator('tbody tr').count();

    await page.getByTestId('prepare-export').click();
    await page.getByTestId('wizard-area').selectOption('communication');
    await page.getByTestId('wizard-report-support').check();
    await page.getByTestId('wizard-period-all').click();
    await expect(page.getByTestId('wizard-filter-supportStatus')).toBeVisible();
    await page.getByTestId('wizard-filter-supportStatus').selectOption('resolved');
    await expect(page.getByTestId('wizard-filter-summary')).toContainText('Estado do suporte');
    await page.getByTestId('wizard-format-csv').click();

    const download = page.waitForEvent('download');
    await page.getByTestId('generate-export').click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/Suporte_.*\.csv$/);
    expect(await downloadedText(file)).toContain('Categoria');

    const historyTable = page.getByTestId('export-history-table');
    await expect(historyTable.locator('tbody tr')).toHaveCount(historyBefore + 1);
    await expect(historyTable.locator('tbody tr').first()).toContainText('Concluída');
    await expect(historyTable.locator('tbody tr').first()).toContainText('Suporte');

    // Persistência do histórico: recarregar e voltar ao módulo mantém o registo desta empresa.
    await page.reload();
    await expect(page.getByTitle('Sessão Iniciada')).toBeVisible({ timeout: 30_000 });
    await page.getByTitle('Sessão Iniciada').click();
    await page.getByRole('button', { name: /Área da Minha Empresa/ }).first().click();
    await page.getByRole('button', { name: 'Relatórios', exact: true }).first().click();
    await page.getByRole('button', { name: 'Exportação de dados' }).click();
    await expect(page.getByTestId('prepare-export')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('export-history-table').locator('tbody tr').first()).toContainText('Suporte');
  });
});
