import { expect, test, type Page } from './fixtures';

/**
 * Módulo Identidade Institucional.
 * Testa o contrato real das APIs administrativas (CRUD, versões, auditoria e
 * permissões) e a navegação do painel. Cria e remove os próprios registos.
 */

const ADMIN = { email: 'admin.teste@guigui.com', password: 'Guigui@2026!' };
const CITIZEN = { email: 'cidadao.teste@guigui.com', password: 'Guigui@2026!' };

async function signIn(page: Page, account: { email: string; password: string }) {
  const response = await page.request.post('/api/auth/login', { data: account });
  const payload = await response.json().catch(() => ({}));
  expect(response.ok(), `login falhou: ${JSON.stringify(payload)}`).toBeTruthy();
  return payload;
}

async function signInAdmin(page: Page) {
  const payload = await signIn(page, ADMIN);
  await page.addInitScript((account) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);
}

const servicePayload = (name: string) => ({
  name,
  description: 'Serviço de teste automatizado',
  detailed_description: 'Detalhe do serviço de teste.',
  icon: 'sparkles',
  image_url: '',
  category: 'plataforma',
  link_url: '/',
  isVisible: true,
});

test.describe('Identidade Institucional — API', () => {
  test('serviços: criar, editar, listar e remover', async ({ page }) => {
    await signIn(page, ADMIN);
    const name = `Serviço QA ${Date.now()}`;

    const created = await page.request.post('/api/admin/institutional/entities/services', {
      data: servicePayload(name),
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    const { item } = await created.json();
    expect(item.name).toBe(name);

    const edited = await page.request.put(`/api/admin/institutional/entities/services/${item.id}`, {
      data: { ...servicePayload(`${name} editado`), detailed_description: 'Versão editada.' },
    });
    expect(edited.ok(), await edited.text()).toBeTruthy();
    expect((await edited.json()).item.name).toBe(`${name} editado`);

    const listing = await page.request.get('/api/admin/institutional');
    expect(listing.ok()).toBeTruthy();
    const document = (await listing.json()).document;
    const stored = document.entities.services.find((service: { id: number }) => String(service.id) === String(item.id));
    expect(stored).toBeTruthy();
    expect(stored.detailedDescription).toBe('Versão editada.');

    const removed = await page.request.delete(`/api/admin/institutional/entities/services/${item.id}`);
    expect(removed.ok(), await removed.text()).toBeTruthy();

    const after = await page.request.get('/api/admin/institutional');
    const remaining = (await after.json()).document.entities.services;
    expect(remaining.find((service: { id: number }) => String(service.id) === String(item.id))).toBeFalsy();
  });

  test('serviços: valida campos obrigatórios', async ({ page }) => {
    await signIn(page, ADMIN);
    const invalid = await page.request.post('/api/admin/institutional/entities/services', {
      data: { name: '', description: '' },
    });
    expect(invalid.status()).toBe(400);
    const payload = await invalid.json();
    expect(payload.code).toBe('INVALID_INSTITUTIONAL_FIELD');
    expect(payload.fieldErrors).toHaveProperty('name');
  });

  test('documentos: guardar versões e consultar histórico', async ({ page }) => {
    await signIn(page, ADMIN);
    const slug = `politica-qa-${Date.now()}`;

    const created = await page.request.post('/api/admin/institutional/entities/documents', {
      data: {
        name: 'Política de Teste',
        slug,
        description: 'Documento de teste',
        content: 'Conteúdo inicial',
        version: '1.0',
        status: 'draft',
        category: 'politica',
        file_url: '',
        document_date: '',
        published_at: '',
        isVisible: true,
      },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    const { item } = await created.json();

    const updated = await page.request.put(`/api/admin/institutional/entities/documents/${item.id}`, {
      data: {
        name: 'Política de Teste',
        slug,
        description: 'Documento de teste',
        content: 'Conteúdo revisto',
        version: '1.1',
        status: 'published',
        category: 'politica',
        file_url: '',
        document_date: '',
        published_at: '',
        isVisible: true,
      },
    });
    expect(updated.ok(), await updated.text()).toBeTruthy();

    const versions = await page.request.get(`/api/admin/institutional/documents/${item.id}/versions`);
    expect(versions.ok(), await versions.text()).toBeTruthy();
    const list = (await versions.json()).versions;
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list[0].version).toBe('1.1');
    expect(list[0].content).toBe('Conteúdo revisto');

    await page.request.delete(`/api/admin/institutional/entities/documents/${item.id}`);
  });

  test('auditoria: registos de criação e edição com responsável', async ({ page }) => {
    await signIn(page, ADMIN);
    const name = `Auditoria QA ${Date.now()}`;
    const created = await page.request.post('/api/admin/institutional/entities/services', {
      data: servicePayload(name),
    });
    expect(created.ok()).toBeTruthy();
    const { item } = await created.json();
    await page.request.put(`/api/admin/institutional/entities/services/${item.id}`, {
      data: servicePayload(`${name} v2`),
    });

    const audit = await page.request.get('/api/admin/institutional/audit?entity=services&limit=50');
    expect(audit.ok(), await audit.text()).toBeTruthy();
    const entries = (await audit.json()).entries;
    const forItem = entries.filter((entry: { entityId: string | null }) => String(entry.entityId) === String(item.id));
    expect(forItem.some((entry: { action: string }) => entry.action === 'create')).toBe(true);
    expect(forItem.some((entry: { action: string }) => entry.action === 'edit')).toBe(true);
    expect(forItem[0].changedBy).toBeTruthy();
    expect(forItem[0].createdAt).toBeTruthy();

    await page.request.delete(`/api/admin/institutional/entities/services/${item.id}`);
  });

  test('políticas: rascunhos não chegam ao snapshot público', async ({ page }) => {
    await signIn(page, ADMIN);
    const name = `Política Rascunho ${Date.now()}`;
    const created = await page.request.post('/api/admin/institutional/entities/documents', {
      data: {
        name,
        slug: `rascunho-${Date.now()}`,
        description: '',
        content: 'Rascunho privado',
        version: '0.1',
        status: 'draft',
        category: 'politica',
        file_url: '',
        document_date: '',
        published_at: '',
        isVisible: true,
      },
    });
    expect(created.ok()).toBeTruthy();
    const { item } = await created.json();

    const publicSnapshot = await page.request.get('/api/institutional');
    expect(publicSnapshot.ok(), await publicSnapshot.text()).toBeTruthy();
    const published = (await publicSnapshot.json()).data;
    const leaked = (published.entities.documents || []).find((doc: { name: string }) => doc.name === name);
    expect(leaked).toBeFalsy();

    await page.request.delete(`/api/admin/institutional/entities/documents/${item.id}`);
  });

  test('segurança: cidadão é rejeitado nas APIs administrativas', async ({ page }) => {
    const citizenLogin = await page.request.post('/api/auth/login', { data: CITIZEN });
    expect(citizenLogin.ok(), await citizenLogin.text()).toBeTruthy();

    const read = await page.request.get('/api/admin/institutional');
    expect(read.status()).toBe(403);

    const write = await page.request.post('/api/admin/institutional/entities/services', {
      data: servicePayload('Serviço não autorizado'),
    });
    expect(write.status()).toBe(403);

    const audit = await page.request.get('/api/admin/institutional/audit');
    expect(audit.status()).toBe(403);
  });
});

test.describe('Identidade Institucional — painel', () => {
  test('abre o módulo, a visão geral e os submódulos novos', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await signInAdmin(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Visão Geral/i }).first()).toBeVisible({ timeout: 30000 });

    // O guia de boas-vindas cobre o painel e intercepta cliques: fecha-o.
    await page.evaluate(() => {
      document.querySelectorAll('[role="dialog"][aria-labelledby="welcome-tour-title"]').forEach((node) => node.remove());
    });

    await page.getByRole('button', { name: 'Identidade Institucional' }).first().click();
    await expect(page.getByRole('heading', { name: /Identidade Institucional/ }).first()).toBeVisible({ timeout: 20000 });

    const moduleNav = page.getByRole('navigation', { name: 'Submódulos institucionais' });
    await expect(moduleNav).toBeVisible({ timeout: 20000 });

    // Visão geral calculada a partir dos dados e não valores estáticos.
    await moduleNav.getByRole('button', { name: 'Visão Geral', exact: true }).click();
    await expect(page.getByText('Estado da organização institucional')).toBeVisible();
    await expect(page.getByText('Módulos completos')).toBeVisible();

    await moduleNav.getByRole('button', { name: 'Serviços Públicos', exact: true }).click();
    await expect(page.getByRole('button', { name: /Adicionar serviço/i })).toBeVisible({ timeout: 20000 });

    await moduleNav.getByRole('button', { name: 'Histórico & Auditoria', exact: true }).click();
    await expect(page.getByText(/registo\(s\)/i)).toBeVisible({ timeout: 20000 });

    expect(errors.filter((message) => !/WebSocket|vite/i.test(message))).toEqual([]);
  });
});
