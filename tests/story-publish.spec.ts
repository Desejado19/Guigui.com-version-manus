import { expect, test, type Page } from './fixtures';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Publicação de stories pelo editor da faixa: uma story com fotografia e outra
 * com vídeo, ambas publicadas pela empresa de demonstração. O teste confirma o
 * upload, a criação na API e a presença das duas no anel da empresa na faixa.
 */

const DEMO_EMAIL = 'empresa.teste@guigui.com';
const DEMO_PASSWORD = 'Guigui@2026!';
const BUSINESS_LABEL = /Coqueiros/i;

/** PNG 1x1 válido — o servidor valida os magic bytes. */
const PHOTO_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Caixa `ftyp` de um MP4: chega para a validação do asset no servidor. */
function videoBytes(): Buffer {
  const buffer = Buffer.alloc(64);
  buffer.writeUInt32BE(24, 0);
  buffer.write('ftyp', 4, 'ascii');
  buffer.write('isom', 8, 'ascii');
  buffer.write('mp41', 16, 'ascii');
  return buffer;
}

async function signInBusiness(page: Page): Promise<void> {
  const response = await page.request.post('/api/auth/login', {
    data: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
  });
  const payload = await response.json() as { user?: Record<string, unknown>; error?: string };
  expect(response.ok(), `login falhou: ${payload.error || response.status()}`).toBeTruthy();

  await page.addInitScript((user) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(user));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);
}

/**
 * A app abre no painel da empresa e volta a ele depois de publicar. Navega até
 * à faixa e só aceita o feed quando o botão do editor fica estável.
 */
async function openFeed(page: Page): Promise<void> {
  const composeButton = page.locator('button:visible', { hasText: 'Criar story' });
  await expect(async () => {
    if (await composeButton.count()) {
      await page.waitForTimeout(800);
      if (await composeButton.count()) return;
    }

    const closeStory = page.locator('button[aria-label="Fechar story"]:visible');
    if (await closeStory.count()) {
      await closeStory.first().click({ timeout: 3_000 });
      return;
    }

    const backToFeed = page.locator('button:visible', { hasText: 'Voltar para o Feed' });
    const feedNav = page.locator('button:visible', { hasText: 'Feed Bissau' });
    const brand = page.locator('button:visible', { hasText: 'Guigui.com' });
    if (await backToFeed.count()) await backToFeed.first().click({ timeout: 3_000 });
    else if (await feedNav.count()) await feedNav.first().click({ timeout: 3_000 });
    else if (await brand.count()) await brand.first().click({ timeout: 3_000 });
    else throw new Error('Sem controlo visível para voltar ao feed.');
  }).toPass({ timeout: 30_000 });

  await expect(composeButton.first()).toBeVisible({ timeout: 20_000 });
}

/** Número de stories do anel da empresa na faixa (1 quando não há badge). */
async function ringStoryCount(page: Page): Promise<number> {
  const ring = page.getByTestId('story-ring').filter({ hasText: BUSINESS_LABEL }).first();
  await expect(ring).toBeVisible({ timeout: 15_000 });
  const match = (await ring.innerText()).match(/^\s*(\d+)/);
  return match ? Number(match[1]) : 1;
}

/** Publica um ficheiro pelo editor e devolve a story criada no servidor. */
async function publishThroughEditor(
  page: Page,
  filePath: string,
  kind: 'image' | 'video',
): Promise<{ id: string; mediaUrl: string }> {
  await openFeed(page);

  const dialog = page.getByRole('dialog', { name: 'Editor de Story' });
  const composeButton = page.locator('button:visible', { hasText: 'Criar story' }).first();
  await expect(composeButton).toBeVisible({ timeout: 20_000 });
  await composeButton.click({ timeout: 15_000 });
  await expect(dialog).toBeVisible({ timeout: 15_000 });

  // A app sincroniza a sessão logo depois de abrir e pode trocar de separador;
  // deixar assentar antes de enviar o ficheiro evita que o editor feche a meio.
  await page.waitForTimeout(2_000);
  if (!(await dialog.count())) {
    await openFeed(page);
    await composeButton.click({ timeout: 15_000 });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1_500);
  }

  await dialog.locator('input[type="file"]').first().setInputFiles(filePath);

  // O editor mostra a pré-visualização com o URL devolvido pelo servidor assim
  // que o upload termina; é esse o sinal usado antes de publicar.
  await expect(dialog.locator(`${kind === 'video' ? 'video' : 'img'}[src^="/uploads/stories/"]`).first())
    .toBeVisible({ timeout: 30_000 });

  const createResponse = page.waitForResponse(
    (response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/stories',
    { timeout: 30_000 },
  );
  await dialog.getByRole('button', { name: 'Publicar story' }).click();
  const created = await createResponse;
  expect(created.status(), `criação da story de ${kind} falhou`).toBe(201);

  const payload = await created.json() as { story?: { id?: string; mediaUrl?: string } };
  expect(payload.story?.id).toBeTruthy();
  await expect(dialog).toHaveCount(0);

  return { id: String(payload.story?.id), mediaUrl: String(payload.story?.mediaUrl || '') };
}

test('publica uma story com fotografia e outra com vídeo e ambas aparecem na faixa', async ({ page }) => {
  test.setTimeout(180_000);

  // Os ficheiros ficam ao lado do spec: o Chromium do Playwright lê-os daqui
  // sem problemas (o diretório de resultados é apagado entre execuções).
  const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');
  const photoPath = path.join(fixturesDir, '.tmp-story-photo.png');
  const videoPath = path.join(fixturesDir, '.tmp-story-video.mp4');
  writeFileSync(photoPath, PHOTO_BYTES);
  writeFileSync(videoPath, videoBytes());
  expect(existsSync(photoPath), `fixture ausente: ${photoPath}`).toBeTruthy();
  expect(existsSync(videoPath), `fixture ausente: ${videoPath}`).toBeTruthy();

  await signInBusiness(page);
  const created: string[] = [];

  try {
    await page.goto('/');
    await page.waitForTimeout(3_000);
    await openFeed(page);
    const before = await ringStoryCount(page);

    const photo = await publishThroughEditor(page, photoPath, 'image');
    created.push(photo.id);
    expect(photo.mediaUrl).toMatch(/^\/uploads\/stories\/.+\.png$/);

    const video = await publishThroughEditor(page, videoPath, 'video');
    created.push(video.id);
    expect(video.mediaUrl).toMatch(/^\/uploads\/stories\/.+\.mp4$/);

    // O servidor guarda as duas stories com o tipo de media certo.
    const listed = await page.request.get('/api/stories');
    expect(listed.ok()).toBeTruthy();
    const { stories = [] } = await listed.json() as {
      stories?: Array<{ id: string; storyType: string; mediaUrl?: string }>;
    };
    const photoStory = stories.find((story) => story.id === photo.id);
    const videoStory = stories.find((story) => story.id === video.id);
    expect(photoStory, 'story de fotografia ausente na API').toMatchObject({ storyType: 'image', mediaUrl: photo.mediaUrl });
    expect(videoStory, 'story de vídeo ausente na API').toMatchObject({ storyType: 'video', mediaUrl: video.mediaUrl });

    // Na faixa, o anel da empresa passa a contar as duas stories publicadas.
    await openFeed(page);
    expect(await ringStoryCount(page)).toBe(before + 2);
  } finally {
    for (const id of created) {
      await page.request.delete(`/api/stories/${encodeURIComponent(id)}`).catch(() => undefined);
    }
    for (const file of [photoPath, videoPath]) {
      try { unlinkSync(file); } catch { /* ficheiro já removido */ }
    }
  }
});
