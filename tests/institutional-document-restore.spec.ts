import { expect, test, type Page } from './fixtures';

/**
 * Restauro de versões de documentos legais.
 *
 * Usa os endpoints reais de documentos para criar duas versões, restaura a
 * primeira e verifica: conteúdo restaurado, novo registo no histórico,
 * auditoria da operação e confirmação no painel (window.confirm).
 */

const ADMIN = { email: 'admin.teste@guigui.com', password: 'Guigui@2026!' };
const CITIZEN = { email: 'cidadao.teste@guigui.com', password: 'Guigui@2026!' };
const NAME = 'Documento de Restauro Playwright';
const SLUG = 'documento-restauro-playwright';
const CONTENT_V1 = 'Versão inicial do documento. Texto A.';
const CONTENT_V2 = 'Versão revista do documento. Texto B.';

// Caso de publicação: slug próprio para não colidir com os restauros em rascunho.
const PUBLISHED_NAME = 'Documento Restaurado e Publicado Playwright';
const PUBLISHED_SLUG = 'documento-restaurado-publicado-playwright';
const PUBLISHED_V1 = 'Texto restaurado que tem de chegar às políticas públicas. Marca-restauro-7c21.';
const PUBLISHED_V2 = 'Texto revisto que não pode aparecer depois do restauro.';

async function signIn(page: Page, account: { email: string; password: string }) {
  const response = await page.request.post('/api/auth/login', { data: account });
  expect(response.ok(), await response.text()).toBeTruthy();
}

async function createVersions(page: Page): Promise<{ id: number }> {
  const created = await page.request.post('/api/admin/institutional/entities/documents', {
    data: { name: NAME, slug: SLUG, content: CONTENT_V1, version: '1.0', status: 'draft' },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const { item } = await created.json();

  const updated = await page.request.put(`/api/admin/institutional/entities/documents/${item.id}`, {
    data: { name: NAME, slug: SLUG, content: CONTENT_V2, version: '2.0', status: 'draft' },
  });
  expect(updated.ok(), await updated.text()).toBeTruthy();
  return { id: item.id };
}

test('API: restaura conteúdo, regista no histórico e audita', async ({ page }) => {
  await signIn(page, ADMIN);
  const { id } = await createVersions(page);

  try {
    const versionsResponse = await page.request.get(`/api/admin/institutional/documents/${id}/versions`);
    expect(versionsResponse.ok(), await versionsResponse.text()).toBeTruthy();
    const versions = (await versionsResponse.json()).versions as Array<{
      id: number;
      version: string;
      content: string;
    }>;
    expect(versions.length).toBeGreaterThanOrEqual(2);
    const firstVersion = versions.find((version) => version.content === CONTENT_V1);
    expect(firstVersion).toBeTruthy();

    const restore = await page.request.post(
      `/api/admin/institutional/documents/${id}/versions/${firstVersion!.id}/restore`,
    );
    expect(restore.ok(), await restore.text()).toBeTruthy();
    const restored = await restore.json();
    expect(restored.item.content).toBe(CONTENT_V1);
    expect(restored.item.version).toBe('1.0');
    expect(restored.restoredFrom.id).toBe(firstVersion!.id);

    // O documento atual (rascunho) reflecte o restauro.
    const admin = await page.request.get('/api/admin/institutional');
    const document = (await admin.json()).document.entities.documents.find(
      (row: { id: number }) => Number(row.id) === Number(id),
    );
    expect(document.content).toBe(CONTENT_V1);

    // A restauração entra no histórico como novo registo.
    const afterVersions = (
      await (await page.request.get(`/api/admin/institutional/documents/${id}/versions`)).json()
    ).versions as Array<{ id: number; content: string }>;
    expect(afterVersions.length).toBe(versions.length + 1);
    expect(afterVersions[0].content).toBe(CONTENT_V1);

    // Auditoria com o responsável e a versão de origem.
    const audit = await page.request.get('/api/admin/institutional/audit?entity=documents&action=restore_version');
    expect(audit.ok(), await audit.text()).toBeTruthy();
    const entries = (await audit.json()).entries as Array<{
      entityId: string;
      changedBy: string | null;
      metadata: Record<string, unknown>;
    }>;
    const entry = entries.find((item) => String(item.entityId) === String(id));
    expect(entry).toBeTruthy();
    expect(entry?.metadata.versionId).toBe(firstVersion!.id);
    expect(entry?.changedBy).toBeTruthy();

    // Cidadão não pode restaurar.
    const citizen = await page.request.post('/api/auth/login', { data: CITIZEN });
    expect(citizen.ok()).toBeTruthy();
    const denied = await page.request.post(
      `/api/admin/institutional/documents/${id}/versions/${firstVersion!.id}/restore`,
    );
    expect(denied.status()).toBe(403);
  } finally {
    await page.request.post('/api/auth/login', { data: ADMIN });
    await page.request.delete(`/api/admin/institutional/entities/documents/${id}`);
  }
});

/**
 * Depois de restaurar uma versão, a publicação manual tem de tornar esse
 * conteúdo visível na página pública de políticas, e o histórico tem de
 * continuar a guardar a versão anterior (a que foi substituída pelo restauro).
 */
test('restauro + publicação manual: aparece nas políticas públicas e o histórico preserva a versão anterior', async ({ page }) => {
  await signIn(page, ADMIN);

  const created = await page.request.post('/api/admin/institutional/entities/documents', {
    data: {
      name: PUBLISHED_NAME,
      slug: PUBLISHED_SLUG,
      description: 'Documento publicado pelo teste de restauro.',
      content: PUBLISHED_V1,
      version: '1.0',
      status: 'published',
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const { item } = await created.json();
  const id = Number(item.id);

  try {
    const updated = await page.request.put(`/api/admin/institutional/entities/documents/${id}`, {
      data: {
        name: PUBLISHED_NAME,
        slug: PUBLISHED_SLUG,
        description: 'Documento publicado pelo teste de restauro.',
        content: PUBLISHED_V2,
        version: '2.0',
        status: 'published',
      },
    });
    expect(updated.ok(), await updated.text()).toBeTruthy();

    const before = (await (await page.request.get(`/api/admin/institutional/documents/${id}/versions`)).json())
      .versions as Array<{ id: number; version: string; content: string }>;
    const restoredCandidate = before.find((version) => version.content === PUBLISHED_V1);
    const previousVersion = before.find((version) => version.content === PUBLISHED_V2);
    expect(restoredCandidate).toBeTruthy();
    expect(previousVersion).toBeTruthy();

    const restore = await page.request.post(
      `/api/admin/institutional/documents/${id}/versions/${restoredCandidate!.id}/restore`,
    );
    expect(restore.ok(), await restore.text()).toBeTruthy();
    expect((await restore.json()).item.content).toBe(PUBLISHED_V1);

    // Sem publicar, o conteúdo restaurado ainda não chegou ao site.
    const beforePublish = await page.request.get('/api/institutional');
    const beforeDocs = (await beforePublish.json()).data.entities.documents as Array<{ slug?: string; content?: string }>;
    expect(beforeDocs.some((doc) => doc.slug === PUBLISHED_SLUG)).toBe(false);

    const publish = await page.request.post('/api/admin/institutional/publish');
    expect(publish.ok(), await publish.text()).toBeTruthy();

    // API pública: o documento passa a existir com a versão restaurada.
    const publicDocs = (await (await page.request.get('/api/institutional')).json())
      .data.entities.documents as Array<{ slug?: string; content?: string; version?: string }>;
    const published = publicDocs.find((doc) => doc.slug === PUBLISHED_SLUG);
    expect(published).toBeTruthy();
    expect(published?.content).toBe(PUBLISHED_V1);
    expect(published?.version).toBe('1.0');

    // Página pública de políticas: mostra o texto restaurado e não o revisto.
    await page.goto(`/politicas/${PUBLISHED_SLUG}`);
    await expect(page.getByRole('heading', { name: PUBLISHED_NAME })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Marca-restauro-7c21/)).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(PUBLISHED_V2)).toHaveCount(0);

    // Histórico: a versão anterior ao restauro continua lá, com o seu conteúdo,
    // e o restauro acrescentou um novo registo.
    const after = (await (await page.request.get(`/api/admin/institutional/documents/${id}/versions`)).json())
      .versions as Array<{ id: number; version: string; content: string }>;
    expect(after.length).toBe(before.length + 1);
    const stillThere = after.find((version) => version.id === previousVersion!.id);
    expect(stillThere).toBeTruthy();
    expect(stillThere?.content).toBe(PUBLISHED_V2);
    expect(stillThere?.version).toBe('2.0');
    expect(after.find((version) => version.id === restoredCandidate!.id)?.content).toBe(PUBLISHED_V1);
  } finally {
    await page.request.post('/api/auth/login', { data: ADMIN });
    await page.request.delete(`/api/admin/institutional/entities/documents/${id}`);
    // A publicação é global: repor o site sem o documento de teste.
    await page.request.post('/api/admin/institutional/publish');
  }

  const remaining = (await (await page.request.get('/api/institutional')).json())
    .data.entities.documents as Array<{ slug?: string }>;
  expect(remaining.some((doc) => doc.slug === PUBLISHED_SLUG)).toBe(false);
});

test('painel: abre o histórico, confirma e restaura a versão', async ({ page }) => {
  await signIn(page, ADMIN);
  const { id } = await createVersions(page);
  const dialogs: string[] = [];

  try {
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Visão Geral/i }).first()).toBeVisible({ timeout: 30000 });
    await page.evaluate(() => {
      document.querySelectorAll('[role="dialog"][aria-labelledby="welcome-tour-title"]').forEach((node) => node.remove());
    });

    await page.getByRole('button', { name: 'Identidade Institucional' }).first().click();
    const moduleNav = page.getByRole('navigation', { name: 'Submódulos institucionais' });
    await moduleNav.getByRole('button', { name: 'Políticas & Documentos', exact: true }).click();

    const row = page.getByRole('row', { name: new RegExp(NAME) }).first();
    await expect(row).toBeVisible({ timeout: 20000 });
    await row.getByRole('button', { name: /Versões/ }).click();

    await expect(page.getByText(/Histórico de versões/)).toBeVisible({ timeout: 20000 });
    const restoreButtons = page.getByRole('button', { name: /Restaurar/ });
    await expect(restoreButtons.first()).toBeVisible({ timeout: 20000 });
    await restoreButtons.nth(1).click();

    // A confirmação é pedida antes de alterar o documento.
    await expect
      .poll(() => dialogs.length, { timeout: 10000 })
      .toBeGreaterThan(0);
    expect(dialogs[0]).toContain('Restaurar a versão');

    await expect(page.getByText(/restaurada para o rascunho/i)).toBeVisible({ timeout: 20000 });

    const admin = await page.request.get('/api/admin/institutional');
    const document = (await admin.json()).document.entities.documents.find(
      (item: { id: number }) => Number(item.id) === Number(id),
    );
    expect(document.content).toBe(CONTENT_V1);
  } finally {
    await page.request.post('/api/auth/login', { data: ADMIN });
    await page.request.delete(`/api/admin/institutional/entities/documents/${id}`);
  }
});
