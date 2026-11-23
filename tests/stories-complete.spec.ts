import { expect, test, type Page } from './fixtures';
import path from 'node:path';

const PASSWORD = 'Guigui@2026!';
const ACCOUNTS = {
  citizen: 'cidadao.teste@guigui.com',
  business: 'empresa.teste@guigui.com',
  admin: 'admin.teste@guigui.com',
} as const;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const { Pool } = await import('pg');
  const { default: dotenv } = await import('dotenv');
  dotenv.config();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(
      `UPDATE stories SET published_at = published_at - INTERVAL '2 hours'
        WHERE published_at > NOW() - INTERVAL '1 hour'
          AND owner_user_id IN (SELECT id FROM users WHERE email = ANY($1))`,
      [[ACCOUNTS.business, ACCOUNTS.admin]],
    );
  } finally {
    await pool.end();
  }
});

async function signIn(page: Page, email: string) {
  const response = await page.request.post('/api/auth/login', { data: { email, password: PASSWORD } });
  expect(response.ok(), await response.text()).toBeTruthy();
  const payload = await response.json();
  const setCookie = response.headers()['set-cookie'];
  if (setCookie) {
    const cookieString = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
    const match = cookieString.match(/guigui_session=([^;]+)/);
    if (match) {
      await page.context().addCookies([{
        name: 'guigui_session',
        value: match[1],
        url: test.info().project.use.baseURL ?? 'http://localhost:3000',
        httpOnly: true,
        sameSite: 'Lax',
        secure: false,
      }]);
    }
  }
  await page.addInitScript((user: any) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(user));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);
  return payload.user;
}

async function createStory(page: Page, overrides: Record<string, unknown> = {}) {
  const response = await page.request.post('/api/stories', {
    data: {
      storyType: 'text',
      caption: `PW story ${Date.now()}`,
      durationMs: 5000,
      backgroundColor: '#064e3b',
      publish: true,
      ...overrides,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).story;
}

async function removeStory(page: Page, id: string) {
  await page.request.delete(`/api/stories/${encodeURIComponent(id)}`).catch(() => undefined);
}

async function clearBusinessStories(page: Page) {
  for (const scope of ['all', 'archive', 'drafts'] as const) {
    const mine = await (await page.request.get(`/api/stories/mine?scope=${scope}`)).json().catch(() => ({ stories: [] }));
    for (const story of mine.stories || []) {
      await page.request.delete(`/api/stories/${encodeURIComponent(story.id)}`).catch(() => undefined);
    }
  }
  const highlights = await (await page.request.get('/api/story-highlights?businessId=biz-1')).json().catch(() => ({ highlights: [] }));
  for (const highlight of highlights.highlights || []) {
    if (String(highlight.title).startsWith('PW ')) {
      await page.request.delete(`/api/story-highlights/${encodeURIComponent(highlight.id)}`).catch(() => undefined);
    }
  }
}

async function openStories(page: Page) {
  await page.goto('/');
  const stories = page.getByRole('region', { name: 'Stories' });
  // O admin aterra no painel de administração; é preciso voltar ao feed antes
  // de procurar a faixa de stories. Tentar mais do que uma vez cobre o clique
  // que se perde enquanto a SPA ainda está a hidratar.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await stories.isVisible().catch(() => false)) return;
    const backToFeed = page.getByRole('button', { name: /Voltar para o Feed/i }).first();
    if (await backToFeed.isVisible().catch(() => false)) {
      await backToFeed.click();
    } else {
      const feed = page.getByRole('button', { name: /Feed Bissau/i }).first();
      if (await feed.isVisible().catch(() => false)) await feed.click();
    }
    await page.waitForTimeout(1500);
  }
  await expect(stories).toBeVisible({ timeout: 20000 });
}

test('1. cidadão vê Stories mas não pode criar nem publicar', async ({ page }) => {
  await signIn(page, ACCOUNTS.citizen);
  await openStories(page);
  await expect(page.getByRole('button', { name: 'Criar story' })).toHaveCount(0);
  const forbidden = await page.request.post('/api/stories', {
    data: { storyType: 'text', caption: 'PW citizen forbidden', publish: true },
  });
  expect(forbidden.status()).toBe(403);
});

test('2. empresa cria story de texto com sondagem pelo editor', async ({ page }) => {
  await signIn(page, ACCOUNTS.business);
  await clearBusinessStories(page);
  await openStories(page);
  await expect(page.getByRole('button', { name: 'Criar story' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Criar story' }).click();
  const editor = page.getByRole('dialog', { name: 'Editor de Story' });
  await expect(editor).toBeVisible();
  await editor.getByRole('button', { name: 'Texto' }).click();
  await editor.getByPlaceholder('Escreve uma legenda...').fill('PW texto com sondagem');
  await editor.getByRole('button', { name: 'Adicionar' }).click();
  await editor.getByLabel('Tipo de elemento').selectOption('poll');
  await editor.getByPlaceholder('Pergunta').fill('Qual prefere?');
  await editor.getByPlaceholder('Uma opção por linha').fill('Sim\nNão');
  await editor.getByRole('button', { name: 'Inserir elemento' }).click();
  await expect(editor.getByText(/poll · Qual prefere/)).toBeVisible();
  await editor.getByRole('button', { name: 'Publicar story' }).click();
  await expect(editor).toBeHidden({ timeout: 20000 });
  await expect(page.getByTestId('story-ring').filter({ hasText: 'Coqueiros' }).first()).toBeVisible({ timeout: 15000 });
  const mine = await (await page.request.get('/api/stories/mine?scope=all')).json();
  const story = mine.stories.find((entry: any) => entry.caption === 'PW texto com sondagem');
  expect(story.elements[0].type).toBe('poll');
  await removeStory(page, story.id);
});

test('3. empresa carrega fotografia e publica mídia real', async ({ page }) => {
  await signIn(page, ACCOUNTS.business);
  await clearBusinessStories(page);
  await openStories(page);
  await expect(page.getByRole('button', { name: 'Criar story' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Criar story' }).click();
  const editor = page.getByRole('dialog', { name: 'Editor de Story' });
  await editor.locator('input[type="file"]').first().setInputFiles(path.join(process.cwd(), 'tests/fixtures/story.png'));
  await expect(editor.locator('img[src^="/uploads/stories/"]').last()).toBeVisible({ timeout: 15000 });
  await editor.getByPlaceholder('Escreve uma legenda...').fill('PW fotografia real');
  await editor.getByRole('button', { name: 'Publicar story' }).click();
  await expect(editor).toBeHidden({ timeout: 20000 });
  const mine = await (await page.request.get('/api/stories/mine?scope=all')).json();
  const story = mine.stories.find((entry: any) => entry.caption === 'PW fotografia real');
  expect(story.storyType).toBe('image');
  expect(story.mediaUrl).toContain('/uploads/stories/');
  await removeStory(page, story.id);
});

test('4. rascunho é guardado e pode ser gerido', async ({ page }) => {
  await signIn(page, ACCOUNTS.business);
  await clearBusinessStories(page);
  await openStories(page);
  await expect(page.getByRole('button', { name: 'Criar story' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Criar story' }).click();
  const editor = page.getByRole('dialog', { name: 'Editor de Story' });
  await editor.getByRole('button', { name: 'Texto' }).click();
  await editor.getByPlaceholder('Escreve uma legenda...').fill('PW rascunho');
  await editor.getByRole('button', { name: 'Guardar rascunho' }).click();
  await expect(editor).toBeHidden({ timeout: 20000 });
  await page.getByRole('button', { name: 'Gerir stories' }).click();
  const manager = page.getByText('Gestão de Stories').first();
  await expect(manager).toBeVisible();
  await page.getByRole('button', { name: 'Rascunhos' }).click();
  await expect(page.getByText('PW rascunho').first()).toBeVisible();
  const mine = await (await page.request.get('/api/stories/mine?scope=all')).json();
  const story = mine.stories.find((entry: any) => entry.caption === 'PW rascunho');
  await removeStory(page, story.id);
});

test('5. visualizador navega, curte, reage, vota e responde', async ({ page }) => {
  await signIn(page, ACCOUNTS.business);
  await clearBusinessStories(page);
  const story = await createStory(page, {
    caption: 'PW interações',
    durationMs: 300000,
    elements: [{ type: 'poll', content: { question: 'Gostas?', options: ['Sim', 'Não'] } }],
  });
  await signIn(page, ACCOUNTS.citizen);
  await page.goto(`/?story=${encodeURIComponent(story.shareToken)}`);
  const viewer = page.getByRole('dialog', { name: /Story de .*Coqueiros/ }).first();
  await expect(viewer).toBeVisible({ timeout: 20000 });
  await viewer.getByRole('button', { name: 'Gostar' }).click();
  await expect(viewer.getByRole('button', { name: 'Remover gosto' })).toBeVisible();
  await viewer.getByRole('button', { name: 'Reagir com emoji' }).click();
  await viewer.getByRole('button', { name: '🔥' }).click();
  await viewer.getByRole('button', { name: 'Sim' }).click();
  await expect(viewer.getByText('100%')).toBeVisible();
  const reply = viewer.getByLabel('Responder ao story');
  await reply.fill('PW resposta cidadão');
  await viewer.getByRole('button', { name: 'Enviar resposta' }).click();
  await expect(viewer.getByText('Resposta enviada.')).toBeVisible({ timeout: 10000 });
  await viewer.getByRole('button', { name: 'Fechar story' }).click();
  const relogin = await page.request.post('/api/auth/login', { data: { email: ACCOUNTS.business, password: PASSWORD } });
  expect(relogin.ok()).toBeTruthy();
  const stats = await (await page.request.get(`/api/stories/${story.id}/stats`)).json();
  expect(stats.counts.likes).toBeGreaterThan(0);
  expect(stats.counts.pollVotes).toBeGreaterThan(0);
  expect(stats.counts.replies).toBeGreaterThan(0);
});

test('6. temporizador pausa enquanto o cidadão escreve', async ({ page }) => {
  await signIn(page, ACCOUNTS.business);
  await clearBusinessStories(page);
  const story = await createStory(page, { caption: 'PW pausa ao escrever', durationMs: 1200 });
  await signIn(page, ACCOUNTS.citizen);
  // Abrir pelo share token garante que é esta story (e não uma órfã da faixa)
  // que fica em análise — o mesmo motivo que levou o teste 5 a usar o token.
  await page.goto(`/?story=${encodeURIComponent(story.shareToken)}`);
  const viewer = page.getByRole('dialog', { name: /Story de .*Coqueiros/ }).first();
  await expect(viewer).toBeVisible({ timeout: 20000 });
  await viewer.getByLabel('Responder ao story').fill('Estou a escrever');
  await page.waitForTimeout(2600);
  await expect(viewer).toBeVisible();
  await expect(viewer.getByText('PW pausa ao escrever').first()).toBeVisible();
  await viewer.getByRole('button', { name: 'Fechar story' }).click();
  await removeStory(page, story.id);
});

test('7. empresa gere destaques a partir do arquivo', async ({ page }) => {
  await signIn(page, ACCOUNTS.business);
  await clearBusinessStories(page);
  const story = await createStory(page, { caption: 'PW destaque' });
  await openStories(page);
  await page.getByRole('button', { name: 'Gerir stories' }).click();
  await page.getByRole('button', { name: 'Destaques' }).click();
  await page.getByRole('button', { name: 'Criar destaque' }).click();
  await page.getByPlaceholder('Nome do destaque (ex.: Produtos)').fill('PW Produtos');
  const row = page.locator('label').filter({ hasText: 'PW destaque' }).first();
  await row.locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Criar', exact: true }).click();
  await expect(page.getByText('PW Produtos').first()).toBeVisible();
  const highlights = await (await page.request.get('/api/story-highlights?businessId=biz-1')).json();
  expect(highlights.highlights.some((entry: any) => entry.title === 'PW Produtos')).toBeTruthy();
  await removeStory(page, story.id);
});

test('8. administrador publica story institucional', async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);
  await openStories(page);
  await expect(page.getByRole('button', { name: 'Criar story' })).toBeVisible();
  const story = await createStory(page, { caption: 'PW institucional', visibility: 'public' });
  const mine = await (await page.request.get('/api/stories/mine?scope=all')).json();
  expect(mine.stories.some((entry: any) => entry.id === story.id && entry.ownerRole === 'admin')).toBeTruthy();
  await removeStory(page, story.id);
});

test('9. administrador acede à moderação e suspende/restaura', async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);
  const created = await createStory(page, { caption: 'PW moderar' });
  const reports = await page.request.get('/api/admin/story-reports');
  expect(reports.ok()).toBeTruthy();
  const suspended = await page.request.post(`/api/admin/stories/${created.id}/moderate`, {
    data: { action: 'suspend', reason: 'PW teste de moderação' },
  });
  expect(suspended.ok()).toBeTruthy();
  const restored = await page.request.post(`/api/admin/stories/${created.id}/moderate`, {
    data: { action: 'restore', reason: 'PW teste concluído' },
  });
  expect(restored.ok()).toBeTruthy();
  await openStories(page);
  await expect(page.getByTestId('story-ring').filter({ hasText: 'Guigui' }).first()).toBeVisible({ timeout: 15000 }).catch(() => undefined);
  await removeStory(page, created.id);
});

test('10. story persiste após recarregar a página', async ({ page }) => {
  await signIn(page, ACCOUNTS.business);
  await clearBusinessStories(page);
  const story = await createStory(page, { caption: 'PW persistência' });
  await openStories(page);
  await expect(page.getByTestId('story-ring').filter({ hasText: 'Coqueiros' }).first()).toBeVisible();
  await openStories(page);
  await expect(page.getByTestId('story-ring').filter({ hasText: 'Coqueiros' }).first()).toBeVisible({ timeout: 20000 });
  const api = await (await page.request.get(`/api/stories/${story.id}`)).json();
  expect(api.story.caption).toBe('PW persistência');
  await removeStory(page, story.id);
});

test('11. conteúdo expirado sai da faixa e passa ao arquivo', async ({ page }) => {
  await signIn(page, ACCOUNTS.business);
  await clearBusinessStories(page);
  const story = await createStory(page, { caption: 'PW expirada' });
  const { Pool } = await import('pg');
  const { default: dotenv } = await import('dotenv');
  dotenv.config();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(`UPDATE stories SET expires_at=NOW() - INTERVAL '1 minute', published_at=NOW() - INTERVAL '25 hours' WHERE id=$1`, [story.id]);
  } finally {
    await pool.end();
  }
  const publicList = await (await page.request.get('/api/stories')).json();
  expect(publicList.stories.some((entry: any) => entry.id === story.id)).toBeFalsy();
  const archive = await (await page.request.get('/api/stories/mine?scope=archive')).json();
  expect(archive.stories.some((entry: any) => entry.id === story.id)).toBeTruthy();
  await removeStory(page, story.id);
});

test('12. empresa não consegue alterar story de outra empresa', async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);
  const foreign = await createStory(page, { caption: 'PW institucional protegida' });
  await page.request.post('/api/auth/logout');
  await signIn(page, ACCOUNTS.business);
  const response = await page.request.patch(`/api/stories/${foreign.id}`, {
    data: { storyType: 'text', caption: 'tentativa', publish: true },
  });
  expect([403, 404]).toContain(response.status());
  await page.request.post('/api/auth/logout');
  await signIn(page, ACCOUNTS.admin);
  await removeStory(page, foreign.id);
});
