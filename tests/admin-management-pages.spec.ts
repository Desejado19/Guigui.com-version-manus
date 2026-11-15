import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = 'admin.teste@guigui.com';
const ADMIN_PASSWORD = 'Guigui@2026!';

async function signInAdmin(page: Page) {
  const response = await page.request.post('/api/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const payload = await response.json().catch(() => ({}));
  expect(response.ok(), `login admin falhou: ${JSON.stringify(payload)}`).toBeTruthy();
  await page.addInitScript((account) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);
}

async function openAdmin(page: Page) {
  await signInAdmin(page);
  await page.goto('/');
  if (!(await page.getByText('PAINEL ADMINISTRATIVO').count())) {
    await page.getByRole('button', { name: /Administrador/ }).first().click();
  }
  await expect(page.getByText('PAINEL ADMINISTRATIVO').first()).toBeVisible({ timeout: 20000 });
}

async function openSidebarItem(page: Page, label: string) {
  await page.locator('aside').getByRole('button', { name: new RegExp(label) }).first().click();
}

test.describe('Admin — navegação por submódulos', () => {
  test('utilizadores: botões directos, sem cartões explicativos, cada um abre a sua página', async ({ page }) => {
    await openAdmin(page);
    await openSidebarItem(page, 'Utilizadores');

    const nav = page.getByRole('navigation', { name: 'Submódulos de utilizadores' });
    await expect(nav).toBeVisible({ timeout: 20000 });
    await expect(nav.getByRole('button')).toHaveCount(6);
    await expect(nav.getByRole('button', { name: /Todas as contas/ })).toBeVisible();
    await expect(page.getByText(/Escolha uma subárea|Pesquisa, filtros, ordenação/)).toHaveCount(0);

    await nav.getByRole('button', { name: /Cidadãos/ }).click();
    await expect(page.getByRole('heading', { name: 'Cidadãos' })).toBeVisible();
    await expect(page.getByText(/Mostrando \d+–\d+ de/)).toBeVisible();

    await page.getByRole('button', { name: /Voltar ao módulo/ }).click();
    await expect(page.getByRole('navigation', { name: 'Submódulos de utilizadores' })).toBeVisible();
  });

  test('empresas: lista dedicada, pesquisa, filtros, paginação e detalhe', async ({ page }) => {
    await openAdmin(page);
    await openSidebarItem(page, 'Empresas & Negócios');

    const nav = page.getByRole('navigation', { name: 'Submódulos de empresas' });
    await expect(nav.getByRole('button')).toHaveCount(5);
    await nav.getByRole('button', { name: 'Lista de empresas' }).click();

    await expect(page.getByRole('heading', { name: 'Lista de empresas' })).toBeVisible();
    await expect(page.getByText(/Mostrando 1–20 de/)).toBeVisible();

    const search = page.getByPlaceholder(/Pesquisar por nome, categoria/);
    await search.fill('coqueiros');
    await expect(page.getByText(/Mostrando 1–1 de/)).toBeVisible();
    await search.fill('');

    await page.locator('select').filter({ has: page.locator('option[value="active"]') }).first().selectOption('active');
    await expect(page.getByText(/empresa\(s\) registada\)|registo\(s\) encontrado/).first()).toBeVisible();
    await page.getByRole('button', { name: 'Limpar' }).click();

    await page.getByRole('button', { name: '2', exact: true }).click();
    await expect(page.getByText(/Mostrando 21–40 de/)).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /CSV/ }).first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('empresas-guigui');

    await page.getByRole('button', { name: 'Ver', exact: true }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByText(/Registo:/)).toBeVisible();
    await page.getByRole('button', { name: 'Fechar ficha' }).click();

    await page.getByRole('button', { name: /Voltar ao módulo/ }).click();
    await expect(page.getByRole('navigation', { name: 'Submódulos de empresas' })).toBeVisible();
  });

  test('destaques: áreas de disponíveis e selecionadas, sem duplicar', async ({ page }) => {
    await openAdmin(page);
    await openSidebarItem(page, 'Empresas & Negócios');
    await page.getByRole('button', { name: /Empresas em destaque/ }).click();

    await expect(page.getByRole('heading', { name: 'Gestão de empresas em destaque' })).toBeVisible();
    await expect(page.getByText('Empresas disponíveis')).toBeVisible();
    await expect(page.getByText('Empresas selecionadas')).toBeVisible();

    const selectedBefore = await page.locator('ol li').count();
    const addButton = page.getByRole('button', { name: 'Adicionar', exact: true }).first();
    if (await addButton.count()) {
      await addButton.click();
      await expect(page.locator('ol li')).toHaveCount(selectedBefore + 1);
      await expect(page.getByText('Alterações por guardar')).toBeVisible();
      await page.getByRole('button', { name: /^Remover / }).last().click();
      await expect(page.locator('ol li')).toHaveCount(selectedBefore);
    }
  });

  test('eventos, bilhetes, transações, promoções e suporte abrem páginas próprias', async ({ page }) => {
    await openAdmin(page);

    await openSidebarItem(page, 'Eventos & Bilhetes');
    const eventsNav = page.getByRole('navigation', { name: 'Submódulos de eventos' });
    await expect(eventsNav.getByRole('button')).toHaveCount(2);
    await eventsNav.getByRole('button', { name: /^Eventos/ }).click();
    await expect(page.getByRole('heading', { name: 'Gestão de eventos' })).toBeVisible();
    await page.getByRole('button', { name: /Voltar ao módulo/ }).click();
    await page.getByRole('button', { name: /^Bilhetes/ }).click();
    await expect(page.getByRole('heading', { name: 'Gestão de bilhetes' })).toBeVisible();

    await openSidebarItem(page, 'Financeiro');
    const financeNav = page.getByRole('navigation', { name: 'Submódulos financeiros' });
    await expect(financeNav.getByRole('button')).toHaveCount(6);
    await financeNav.getByRole('button', { name: 'Transações', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Transações', exact: true })).toBeVisible();

    await openSidebarItem(page, 'Empresas & Negócios');
    await page.getByRole('button', { name: 'Promoções', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Gestão de promoções' })).toBeVisible();

    await openSidebarItem(page, 'Suporte');
    await expect(page.getByRole('heading', { name: 'Gestão de chamados de suporte' })).toBeVisible();
  });

  test('equipa, sessões, auditoria e relatórios abrem directamente sem passo intermédio', async ({ page }) => {
    await openAdmin(page);

    await openSidebarItem(page, 'Equipa');
    const teamNav = page.getByRole('navigation', { name: 'Submódulos da equipa' });
    await expect(teamNav.getByRole('button')).toHaveCount(2);
    await teamNav.getByRole('button', { name: /Administradores e funcionários/ }).click();
    await expect(page.getByRole('heading', { name: 'Administradores e funcionários' })).toBeVisible();
    await page.getByRole('button', { name: /Voltar ao módulo/ }).click();
    await page.getByRole('button', { name: /Sessões e dispositivos/ }).click();
    await expect(page.getByRole('heading', { name: 'Sessões e dispositivos' })).toBeVisible();

    await openSidebarItem(page, 'Auditoria');
    await expect(page.getByRole('heading', { name: 'Registos de auditoria' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Abrir registos de auditoria/ })).toHaveCount(0);

    await openSidebarItem(page, 'Relatórios');
    await expect(page.getByRole('heading', { name: 'Relatórios e documentos' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Abrir relatórios e documentos/ })).toHaveCount(0);
  });

  test('tabela de empresas não repete identificadores', async ({ page }) => {
    await openAdmin(page);
    await openSidebarItem(page, 'Empresas & Negócios');
    await page.getByRole('button', { name: 'Lista de empresas' }).click();
    const ids = await page.locator('tbody tr td:nth-child(1) div div:nth-child(2)').allInnerTexts();
    const unique = new Set(ids.filter(Boolean));
    expect(unique.size).toBe(ids.filter(Boolean).length);
  });

  test('layout móvel mantém a lista de empresas utilizável', async ({ page }) => {
    await openAdmin(page);
    await openSidebarItem(page, 'Empresas & Negócios');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Lista de empresas' }).click();
    await expect(page.getByRole('heading', { name: 'Lista de empresas' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Voltar ao módulo/ })).toBeVisible();
  });
});
