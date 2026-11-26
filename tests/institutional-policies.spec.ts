import { expect, test } from './fixtures';

/**
 * Páginas públicas de políticas.
 *
 * Cria um documento publicado e um rascunho reais, publica uma versão e prova
 * que a página pública mostra título, versão e conteúdo do documento publicado
 * e nunca o rascunho. No fim remove os documentos de teste e republica.
 */

const ADMIN = { email: 'admin.teste@guigui.com', password: 'Guigui@2026!' };
const SLUG = 'politica-teste-playwright';
const DRAFT_SLUG = 'rascunho-teste-playwright';
const TITLE = 'Política de Teste Playwright';
const DRAFT_TITLE = 'Rascunho de Teste Playwright';
const CONTENT = 'Conteúdo oficial de teste: os dados pessoais são tratados com transparência. Marca-única-9f3a.';

test('página pública mostra o documento publicado com título, versão e conteúdo (nunca rascunhos)', async ({ page }) => {
  const login = await page.request.post('/api/auth/login', { data: ADMIN });
  expect(login.ok(), await login.text()).toBeTruthy();

  const created: number[] = [];
  const createDocument = async (data: Record<string, unknown>) => {
    const response = await page.request.post('/api/admin/institutional/entities/documents', { data });
    expect(response.ok(), await response.text()).toBeTruthy();
    const item = (await response.json()).item;
    created.push(item.id);
    return item.id as number;
  };

  try {
    await createDocument({
      name: TITLE,
      slug: SLUG,
      description: 'Documento criado pelo teste automático.',
      content: CONTENT,
      version: '9.9',
      status: 'published',
      category: 'legal',
      document_date: '2026-01-15',
      published_at: '2026-01-15',
    });
    await createDocument({
      name: DRAFT_TITLE,
      slug: DRAFT_SLUG,
      content: 'Este texto é um rascunho e não pode aparecer no site.',
      version: '0.1',
      status: 'draft',
    });

    const publish = await page.request.post('/api/admin/institutional/publish');
    expect(publish.ok(), await publish.text()).toBeTruthy();

    // API pública: publicado presente com conteúdo, rascunho ausente.
    const publicApi = await page.request.get('/api/institutional');
    expect(publicApi.ok(), await publicApi.text()).toBeTruthy();
    const documents = (await publicApi.json()).data.entities.documents as Array<Record<string, unknown>>;
    const published = documents.find((doc) => doc.slug === SLUG);
    expect(published).toBeTruthy();
    expect(published?.content).toBe(CONTENT);
    expect(published?.version).toBe('9.9');
    expect(documents.some((doc) => doc.slug === DRAFT_SLUG)).toBe(false);

    // HTML inicial servido pelo servidor: título, descrição e canónica próprios
    // do documento publicado, sem depender de JavaScript.
    const shell = await page.request.get(`/politicas/${SLUG}`);
    expect(shell.ok(), await shell.text()).toBeTruthy();
    const shellHtml = await shell.text();
    expect(shellHtml).toContain(`<title>${TITLE} (v9.9) — `);
    expect(shellHtml).toContain('<meta name="description" content="Documento criado pelo teste automático." />');
    expect(shellHtml).toMatch(new RegExp(`<link rel="canonical" href="[^"]+/politicas/${SLUG}" />`));
    expect(shellHtml).toContain('<meta property="og:type" content="article" />');
    expect(shellHtml).not.toContain(DRAFT_TITLE);

    const indexShell = await page.request.get('/politicas');
    expect(await indexShell.text()).toContain('<title>Políticas e documentos legais — ');

    // Um slug não publicado não recebe metadados de documento nem é indexável.
    const draftShell = await page.request.get(`/politicas/${DRAFT_SLUG}`);
    const draftHtml = await draftShell.text();
    expect(draftHtml).toContain('<meta name="robots" content="noindex" />');
    expect(draftHtml).not.toContain(DRAFT_TITLE);

    // Página individual: título, versão e conteúdo reais.
    await page.goto(`/politicas/${SLUG}`);
    await expect(page.getByRole('heading', { name: TITLE })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Versão 9.9')).toBeVisible();
    await expect(page.getByText(/Marca-única-9f3a/)).toBeVisible();

    // Rascunho: nunca acessível por URL directa nem no índice.
    await page.goto(`/politicas/${DRAFT_SLUG}`);
    await expect(page.getByRole('heading', { name: 'Documento não encontrado' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Este texto é um rascunho')).toHaveCount(0);

    await page.goto('/politicas');
    await expect(page.getByRole('heading', { name: 'Políticas e documentos legais' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('link', { name: new RegExp(TITLE) })).toBeVisible();
    await expect(page.getByRole('link', { name: new RegExp(DRAFT_TITLE) })).toHaveCount(0);
  } finally {
    for (const id of created) {
      await page.request.delete(`/api/admin/institutional/entities/documents/${id}`);
    }
    const republish = await page.request.post('/api/admin/institutional/publish');
    expect(republish.ok(), await republish.text()).toBeTruthy();
  }

  const after = await page.request.get('/api/institutional');
  const remaining = (await after.json()).data.entities.documents as Array<Record<string, unknown>>;
  expect(remaining.some((doc) => doc.slug === SLUG || doc.slug === DRAFT_SLUG)).toBe(false);
});
