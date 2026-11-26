import 'dotenv/config';
import { Pool } from 'pg';
import { expect, test } from './fixtures';

const EVENT_PUBLISHED = 'evt-s2-published';
const EVENT_DRAFT = 'evt-s2-draft';
const BUSINESS_ACTIVE = 'biz-1';
const BUSINESS_DRAFT = 'biz-s2-draft';
const STORY_PUBLISHED = 'story-s2-published';
const STORY_DRAFT = 'story-s2-draft';
const BUSINESS_ACCOUNT = { email: 'empresa.teste@guigui.com', password: 'Guigui@2026!' };
const ADMIN_ACCOUNT = { email: 'admin.teste@guigui.com', password: 'Guigui@2026!' };

test.describe.configure({ mode: 'serial' });

async function withDb<T>(run: (pool: Pool) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  try {
    return await run(pool);
  } finally {
    await pool.end();
  }
}

let originalStories: unknown = null;

test.beforeAll(async () => {
  await withDb(async (pool) => {
    const owner = await pool.query('SELECT id FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1', [BUSINESS_ACCOUNT.email]);
    const ownerId = owner.rows[0]?.id;
    expect(ownerId).toBeTruthy();

    await pool.query('DELETE FROM events WHERE id = ANY($1)', [[EVENT_PUBLISHED, EVENT_DRAFT]]);
    await pool.query('DELETE FROM companies WHERE id=$1', [BUSINESS_DRAFT]);
    await pool.query(
      `INSERT INTO companies (id, owner_user_id, name, status, category_id, data)
       VALUES ($1, $2, 'Empresa S2 em rascunho', 'pending', 'services', '{}'::jsonb)`,
      [BUSINESS_DRAFT, ownerId],
    );
    await pool.query(
      `INSERT INTO company_members (company_id, user_id, member_role, accepted_at, permissions, access, status)
       VALUES ($1, $2, 'owner', NOW(), '{}'::jsonb, '{}'::jsonb, 'active')`,
      [BUSINESS_DRAFT, ownerId],
    );
    await pool.query(
      `INSERT INTO events (id, company_id, title, status, starts_at, ends_at)
       VALUES ($1, $2, 'Evento S2 publicado', 'published', NOW() + interval '1 day', NOW() + interval '2 days'),
              ($3, $2, 'Evento S2 em rascunho', 'draft', NOW() + interval '1 day', NOW() + interval '2 days')`,
      [EVENT_PUBLISHED, BUSINESS_DRAFT, EVENT_DRAFT],
    );

    const state = await pool.query("SELECT value FROM app_state WHERE key='guigui_stories'");
    originalStories = state.rows[0]?.value ?? [];
    const stories = Array.isArray(originalStories) ? [...originalStories] : [];
    stories.push(
      {
        id: STORY_PUBLISHED,
        ownerUserId: ownerId,
        ownerRole: 'business',
        businessId: BUSINESS_DRAFT,
        businessName: 'Empresa S2 em rascunho',
        businessLogo: '',
        caption: 'Story publicado S2',
        createdAt: new Date().toISOString(),
        status: 'active',
        moderationStatus: 'approved',
        visibility: 'public',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      {
        id: STORY_DRAFT,
        ownerUserId: ownerId,
        ownerRole: 'business',
        businessId: BUSINESS_DRAFT,
        businessName: 'Empresa S2 em rascunho',
        businessLogo: '',
        caption: 'Story em rascunho S2',
        createdAt: new Date().toISOString(),
        status: 'draft',
        visibility: 'public',
      },
    );
    await pool.query(
      `INSERT INTO app_state (key, value) VALUES ('guigui_stories', $1::jsonb)
       ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`,
      [JSON.stringify(stories)],
    );
  });
});

test.afterAll(async () => {
  await withDb(async (pool) => {
    await pool.query('DELETE FROM events WHERE id = ANY($1)', [[EVENT_PUBLISHED, EVENT_DRAFT]]);
    await pool.query('DELETE FROM companies WHERE id=$1', [BUSINESS_DRAFT]);
    await pool.query(
      `INSERT INTO app_state (key, value) VALUES ('guigui_stories', $1::jsonb)
       ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`,
      [JSON.stringify(Array.isArray(originalStories) ? originalStories : [])],
    );
  });
});

function eventIds(payload: any): string[] {
  return (payload.events || []).map((event: any) => String(event.id));
}

function businessIds(payload: any): string[] {
  return (payload.businesses || []).map((business: any) => String(business.id));
}

function storyIds(payload: any): string[] {
  return (payload.data?.stories || []).map((story: any) => String(story.id));
}

test('sem sessão, as rotas públicas não expõem eventos, empresas nem stories em rascunho', async ({ request }) => {
  const events = await request.get('/api/events');
  expect(events.ok()).toBeTruthy();
  const eventList = eventIds(await events.json());
  expect(eventList).toContain(EVENT_PUBLISHED);
  expect(eventList).not.toContain(EVENT_DRAFT);

  const businesses = await request.get('/api/businesses');
  expect(businesses.ok()).toBeTruthy();
  const businessList = businessIds(await businesses.json());
  expect(businessList).toContain(BUSINESS_ACTIVE);
  expect(businessList).not.toContain(BUSINESS_DRAFT);

  const bootstrap = await request.get('/api/sync/bootstrap?sections=events,businesses,stories');
  expect(bootstrap.ok()).toBeTruthy();
  const payload = await bootstrap.json();
  expect(eventIds({ events: payload.data?.events || [] })).not.toContain(EVENT_DRAFT);
  expect(businessIds({ businesses: payload.data?.businesses || [] })).not.toContain(BUSINESS_DRAFT);
  expect(storyIds(payload)).toContain(STORY_PUBLISHED);
  expect(storyIds(payload)).not.toContain(STORY_DRAFT);
});

test('o dono autenticado vê os seus rascunhos nas três rotas', async ({ page }) => {
  const login = await page.request.post('/api/auth/login', { data: BUSINESS_ACCOUNT });
  expect(login.ok()).toBeTruthy();

  const events = await page.request.get('/api/events');
  expect(eventIds(await events.json())).toContain(EVENT_DRAFT);

  const businesses = await page.request.get('/api/businesses');
  expect(businessIds(await businesses.json())).toContain(BUSINESS_DRAFT);

  const bootstrap = await page.request.get('/api/sync/bootstrap?sections=events,businesses,stories');
  const payload = await bootstrap.json();
  expect(eventIds({ events: payload.data?.events || [] })).toContain(EVENT_DRAFT);
  expect(businessIds({ businesses: payload.data?.businesses || [] })).toContain(BUSINESS_DRAFT);
  expect(storyIds(payload)).toContain(STORY_DRAFT);
});

test('o admin vê todos os rascunhos nas três rotas', async ({ page }) => {
  const login = await page.request.post('/api/auth/login', { data: ADMIN_ACCOUNT });
  expect(login.ok()).toBeTruthy();

  const events = await page.request.get('/api/events');
  expect(eventIds(await events.json())).toContain(EVENT_DRAFT);

  const businesses = await page.request.get('/api/businesses');
  expect(businessIds(await businesses.json())).toContain(BUSINESS_DRAFT);

  const bootstrap = await page.request.get('/api/sync/bootstrap?sections=events,businesses,stories');
  const payload = await bootstrap.json();
  expect(eventIds({ events: payload.data?.events || [] })).toContain(EVENT_DRAFT);
  expect(businessIds({ businesses: payload.data?.businesses || [] })).toContain(BUSINESS_DRAFT);
  expect(storyIds(payload)).toContain(STORY_DRAFT);
});
