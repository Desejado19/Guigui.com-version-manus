import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();

test.describe('PostgreSQL marketplace', () => {
  test.skip(!testDatabaseUrl, 'TEST_DATABASE_URL must point to the verified disposable PostgreSQL 18 database.');

  let businessId: string;
  let businessName: string;
  let eventId: string;
  let eventTitle: string;
  let businessService: typeof import('../server/postgresBusinessService');
  let databasePool: (typeof import('../server/db'))['databasePool'];

  test.beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required for PostgreSQL marketplace tests.');
    process.env.DATABASE_URL = testDatabaseUrl;
    ({ databasePool } = await import('../server/db'));
    businessService = await import('../server/postgresBusinessService');

    const fixtureId = randomUUID();
    businessId = `pw-marketplace-business-${fixtureId}`;
    businessName = `Teste PostgreSQL ${fixtureId}`;
    eventId = `pw-marketplace-event-${fixtureId}`;
    eventTitle = `Evento PostgreSQL ${fixtureId}`;

    await businessService.persistPostgresBusiness({
      id: businessId,
      name: businessName,
      categoryId: 'cat-1',
      status: 'active',
      data: {
        categoryId: 'cat-1',
        subcategoryId: 'cat-1-restaurantes',
        groupGroupId: 'restauracao',
        description: 'Empresa sintética de teste de integração.',
        neighborhood: 'Bandim',
        address: 'Rua de teste',
        phone: '+245955000000',
        whatsapp: '+245955000000',
        openingHours: '09:00 - 18:00',
      },
    });

    const eventDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await businessService.persistPostgresEvent({
      id: eventId,
      businessId,
      title: eventTitle,
      status: 'active',
      date: eventDate,
      time: '18:00',
      data: {
        organizerName: businessName,
        category: 'cultural',
        date: eventDate,
        time: '18:00',
        location: 'Bandim',
        neighborhood: 'Bandim',
        coverImage: '',
        description: 'Evento sintético de teste de integração.',
        ticketTypes: [],
      },
    });
  });

  test.afterAll(async () => {
    await databasePool?.end();
  });

  test('loads database records after reload and uses the PostgreSQL category catalog', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('guigui_current_lang', 'pt');
    });
    await page.goto('/');

    const health = await page.request.get('/api/health');
    expect(health.ok()).toBeTruthy();
    expect((await health.json()).database.configured).toBe(true);

    const categoryResponse = await page.request.get('/api/categories');
    expect(categoryResponse.ok()).toBeTruthy();
    const categoryCatalog = await categoryResponse.json();
    expect(categoryCatalog.categories).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'cat-1', name: 'Restauração e Bebidas' }),
    ]));

    const businessResponse = await page.request.get('/api/businesses');
    const eventResponse = await page.request.get('/api/events');
    expect(businessResponse.ok()).toBeTruthy();
    expect(eventResponse.ok()).toBeTruthy();
    expect((await businessResponse.json()).businesses).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: businessId, name: businessName }),
    ]));
    expect((await eventResponse.json()).events).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: eventId, title: eventTitle }),
    ]));

    const reloadedEventsResponse = page.waitForResponse((response) => {
      const requestUrl = new URL(response.url());
      return requestUrl.pathname === '/api/events'
        && response.request().method() === 'GET'
        && response.ok();
    });
    await page.reload();
    const reloadedEvents = await (await reloadedEventsResponse).json();
    expect(reloadedEvents.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: eventId, title: eventTitle }),
    ]));
    await expect(page.getByRole('heading', { name: /Encontre tudo o que precisa/i })).toBeVisible();
    const directoryButton = page.getByRole('button', { name: /Diretório de Empresas|Business Directory/i }).first();
    await expect(directoryButton).toBeVisible();
    await directoryButton.click();

    const categoryMenu = page.getByRole('button', { name: /Filtrar por categoria/i });
    await expect(categoryMenu).toBeVisible();
    await categoryMenu.click();
    const categoryFilter = page.getByRole('option', { name: 'Restauração e Bebidas' });
    await expect(categoryFilter).toBeVisible();
    await categoryFilter.click();

    const businessCard = page.getByText(businessName).first();
    await expect(businessCard).toBeVisible();
    await expect(page.getByText('Restauração e Bebidas').last()).toBeVisible();
  });
});
