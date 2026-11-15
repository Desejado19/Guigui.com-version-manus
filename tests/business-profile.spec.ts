import { expect, test, type Page } from '@playwright/test';
import type { Business } from '../src/types';
import { DEFAULT_MONETIZATION_CATALOG } from '../src/data/monetizationCatalog';

const DEMO_PASSWORD = 'Guigui@2026!';

function createBusiness(overrides: Partial<Business> & Pick<Business, 'id' | 'name'>): Business {
  return {
    id: overrides.id,
    name: overrides.name,
    slug: overrides.id,
    logo: '',
    coverImage: '',
    gallery: [],
    description: 'Uma empresa local com serviços para a comunidade.',
    categoryId: 'restauracao',
    subcategoryId: 'Comércio local',
    groupGroupId: 'restauracao',
    tier: 'basic',
    neighborhood: 'Bandim',
    address: '',
    phone: '+245 955 00 001',
    whatsapp: '',
    openingHours: '',
    isOpenNow: false,
    priceRange: '$',
    status: 'active',
    verified: false,
    featured: false,
    ratingLabel: '',
    reviewsCount: 0,
    reviews: [],
    posts: [],
    promotions: [],
    metrics: { views: 0, whatsappClicks: 0, phoneClicks: 0, directionsClicks: 0, websiteClicks: 0 },
    subscriptionRenewDate: '2027-01-01T00:00:00.000Z',
    postsQuotaRemaining: 3,
    ...overrides,
  };
}

async function mockBusinessData(page: Page, businesses: Business[]) {
  // Pre-popula o localStorage com os negócios mockados para garantir que o
  // useMarketplaceData use os dados mockados (o fetch pode ser sobrescrito pelo
  // persistChanges do useMarketplaceData, que POSTs os negócios de volta ao servidor).
  await page.addInitScript((businesses) => {
    window.localStorage.setItem('guigui_businesses', JSON.stringify(businesses));
    window.localStorage.setItem('guigui_events', JSON.stringify([]));
  }, businesses);
  await page.route('**/api/businesses', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ businesses }),
  }));
  await page.route('**/api/app-state/guigui_businesses', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ key: 'guigui_businesses', value: businesses }),
  }));
}

async function signInDemo(page: Page, email: string): Promise<Record<string, unknown>> {
  const response = await page.request.post('/api/auth/login', {
    data: { email, password: DEMO_PASSWORD },
  });
  const payload = await response.json().catch(() => ({})) as { user?: Record<string, unknown>; error?: string };
  expect(response.ok(), `login de demonstração falhou: ${payload.error || response.status()}`).toBeTruthy();
  expect(payload.user).toBeTruthy();

  const setCookie = response.headers()['set-cookie'];
  if (setCookie) {
    const cookieString = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
    const cookieMatch = cookieString.match(/guigui_session=([^;]+)/);
    if (cookieMatch) {
      await page.context().addCookies([{
        name: 'guigui_session',
        value: cookieMatch[1],
        url: test.info().project.use.baseURL ?? 'http://127.0.0.1:3000',
        httpOnly: true,
        sameSite: 'Lax',
        secure: false,
      }]);
    }
  }

  await page.addInitScript((user) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(user));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);
  return payload.user!;
}

async function openRoleDashboard(page: Page, label: string) {
  await expect(page.getByTitle('Sessão Iniciada')).toBeVisible({ timeout: 20_000 });
  await page.getByTitle('Sessão Iniciada').click();
  await page.locator('button').filter({ hasText: label }).first().click();
  await expect(page.locator('.guigui-profile-dashboard')).toBeVisible({ timeout: 20_000 });
}

test.describe('perfis empresariais e destaques públicos', () => {
  test('regista o perfil empresarial completo sem misturar o contacto privado da conta', async ({ page }) => {
    let registrationPayload: Record<string, unknown> | undefined;
    await page.route('**/api/payments/create', (route) => route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ transaction: { id: 'e2e-payment', providerRef: 'E2E-PAYMENT' } }),
    }));
    await page.route('**/api/auth/register', async (route) => {
      registrationPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'e2e-business-user', name: 'Padaria de Teste', role: 'business', businessId: 'e2e-business' },
          business: createBusiness({ id: 'e2e-business', name: 'Padaria de Teste' }),
        }),
      });
    });

    await page.goto('/');
    await page.locator('button:has-text("Entrar"), a:has-text("Entrar")').first().click();
    await page.getByText('Criar Nova Conta', { exact: true }).click();
    await page.getByRole('button', { name: 'Próximo Passo', exact: true }).click();
    await page.getByText('Empresa', { exact: true }).click();

    await page.getByPlaceholder('ex: Restaurante Coqueiros').fill('Padaria de Teste');
    await page.locator('#business-registration-subcategory').fill('Padaria');
    await page.locator('#business-registration-description').fill('Padaria local com pão fresco e produtos para a comunidade.');
    await page.locator('#business-registration-phone').fill('+245 955 11 222');
    await page.locator('#business-registration-neighborhood').selectOption('Bandim');
    await page.locator('#business-registration-public-email').fill('contacto@padaria.test');
    await page.getByPlaceholder('ex: contacto@exemplo.com').fill('conta@padaria.test');
    await page.locator('#registration-account-phone').fill('+245 955 22 333');
    await page.locator('input[type="password"]').last().fill('SenhaE2E2026!');
    await page.getByRole('button', { name: /Próximo Passo \(Escalão\)/ }).click();
    await page.getByRole('button', { name: /Próximo Passo \(Pagamento:/ }).click();
    await page.getByRole('button', { name: /^Pagar / }).click();
    await expect(page.getByText('Pagamento Confirmado com Sucesso!')).toBeVisible();
    await page.getByRole('button', { name: /Concluir e Entrar no Painel da Empresa/ }).click();

    await expect.poll(() => registrationPayload).toBeTruthy();
    expect(registrationPayload).toMatchObject({
      role: 'business',
      email: 'conta@padaria.test',
      phone: '+245 955 22 333',
      businessPhone: '+245 955 11 222',
      businessNeighborhood: 'Bandim',
      publicEmail: 'contacto@padaria.test',
      subcategoryId: 'Padaria',
    });
  });

  test('keeps private email out of public data and renders only the explicit public contact', async ({ page }) => {
    const response = await page.request.get('/api/businesses');
    expect(response.ok(), await response.text()).toBeTruthy();
    const publicData = await response.json() as { businesses?: Array<Record<string, unknown>> };
    for (const business of publicData.businesses || []) {
      expect(business).not.toHaveProperty('email');
      expect(business).not.toHaveProperty('ownerEmail');
    }

    const business = createBusiness({
      id: 'e2e-public-profile',
      name: 'Perfil Público de Teste',
      email: 'privado@padaria.test',
      publicEmail: 'contacto@padaria.test',
    });
    await mockBusinessData(page, [business]);
    await page.addInitScript(() => window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt')));
    await page.goto('/');
    await page.getByRole('button', { name: /Business Directory|Diretório de Empresas/i }).first().click();
    await page.getByText('Perfil Público de Teste', { exact: true }).first().click();

    const profile = page.locator('div.fixed.inset-0.z-50').first();
    await expect(profile).toBeVisible();
    await expect(profile).toContainText('contacto@padaria.test');
    await expect(profile).not.toContainText('privado@padaria.test');
  });

  test('shows profile save failures without reporting success', async ({ page }) => {
    const user = await signInDemo(page, 'empresa.teste@guigui.com');
    // Empresa dedicada ao teste: usar o id real faria a lista de empresas do
    // arranque (com o plano já expirado na base de dados) sobrepor-se ao mock e
    // o editor bloqueava com "renovar o plano" antes de tentar gravar.
    const business = createBusiness({ id: 'e2e-profile-save', name: 'Empresa E2E' });
    business.subscriptionRenewDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    business.tier = 'professional';
    business.subscriptionStatus = 'active';
    await page.addInitScript((account) => {
      window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    }, { ...user, businessId: business.id });
    await mockBusinessData(page, [business]);
    await page.route('**/api/businesses/*/profile', (route) => route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Falha de persistência simulada.' }),
    }));

    await page.goto('/');
    await openRoleDashboard(page, 'Área da Minha Empresa');
    await page.getByRole('button', { name: 'Minha Empresa' }).first().click();
    await page.getByRole('button', { name: 'Actualizar dados da empresa' }).click();

    await expect(page.getByRole('alert')).toContainText('Falha de persistência simulada.');
    await expect(page.getByRole('status').filter({ hasText: 'Dados guardados.' })).toHaveCount(0);
  });

  test('saves the business profile, reports success and keeps the data after reload', async ({ page }) => {
    const user = await signInDemo(page, 'empresa.teste@guigui.com');
    // Empresa dedicada: o id real traria a empresa suspensa da base de dados e
    // o editor bloquearia antes de gravar (ver o teste de falha abaixo).
    let stored = createBusiness({ id: 'e2e-profile-success', name: 'Empresa E2E Antes' });
    stored.subscriptionRenewDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    stored.tier = 'professional';
    stored.subscriptionStatus = 'active';

    await page.addInitScript((account) => {
      window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    }, { ...user, businessId: stored.id });
    await page.addInitScript((businesses) => {
      window.localStorage.setItem('guigui_businesses', JSON.stringify(businesses));
      window.localStorage.setItem('guigui_events', JSON.stringify([]));
    }, [stored]);

    // Servidor simulado: aceita o PATCH e passa a devolver os dados guardados,
    // como faria a base de dados depois de uma gravação bem sucedida.
    let patchPayload: Record<string, unknown> | undefined;
    await page.route('**/api/businesses', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ businesses: [stored] }),
    }));
    await page.route('**/api/app-state/guigui_businesses', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ key: 'guigui_businesses', value: [stored] }),
    }));
    await page.route('**/api/businesses/*/profile', async (route) => {
      patchPayload = route.request().postDataJSON() as Record<string, unknown>;
      stored = { ...stored, ...(patchPayload as Partial<Business>) };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ business: patchPayload }),
      });
    });

    await page.goto('/');
    await openRoleDashboard(page, 'Área da Minha Empresa');
    await page.getByRole('button', { name: 'Minha Empresa' }).first().click();

    await page.locator('#business-name').fill('Empresa E2E Actualizada');
    await page.locator('#business-phone').fill('+245 955 77 888');
    await page.getByRole('button', { name: 'Actualizar dados da empresa' }).click();

    // O aviso de sucesso aparece e o servidor recebeu os novos dados.
    await expect(page.getByRole('status').filter({ hasText: 'Dados guardados.' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(patchPayload).toMatchObject({ name: 'Empresa E2E Actualizada', phone: '+245 955 77 888' });

    // Os dados ficam no cache local da empresa.
    await expect.poll(async () => page.evaluate(() => {
      const list = JSON.parse(window.localStorage.getItem('guigui_businesses') || '[]') as Array<{ id: string; name: string }>;
      return list.find((business) => business.id === 'e2e-profile-success')?.name;
    })).toBe('Empresa E2E Actualizada');

    // Depois de recarregar, o formulário continua com os valores guardados.
    await page.reload();
    await openRoleDashboard(page, 'Área da Minha Empresa');
    await page.getByRole('button', { name: 'Minha Empresa' }).first().click();
    await expect(page.locator('#business-name')).toHaveValue('Empresa E2E Actualizada');
    await expect(page.locator('#business-phone')).toHaveValue('+245 955 77 888');
  });

  test('saves administrator ordering using active records only', async ({ page }) => {
    await signInDemo(page, 'admin.teste@guigui.com');
    const businesses = [
      createBusiness({ id: 'e2e-featured-first', name: 'Primeiro destaque', homepageFeaturedOrder: 0 }),
      createBusiness({ id: 'e2e-featured-next', name: 'Segundo destaque' }),
      createBusiness({ id: 'e2e-featured-pending', name: 'Empresa pendente', status: 'pending' }),
    ];
    let savedIds: string[] | undefined;
    await mockBusinessData(page, businesses);
    await page.route('**/api/admin/businesses/featured', async (route) => {
      savedIds = (route.request().postDataJSON() as { businessIds: string[] }).businessIds;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, businesses: [] }),
      });
    });

    await page.goto('/');
    await openRoleDashboard(page, 'Administração Guigui.com');
    await page.getByRole('button', { name: 'Empresas & Negócios' }).click();
    await page.getByRole('button', { name: /^Empresas em destaque/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Gestão de empresas em destaque' })).toBeVisible();
    // Só empresas ativas entram na lista de destaques.
    await expect(page.getByText('Empresa pendente')).toHaveCount(0);
    await page
      .locator('div.flex.items-center.justify-between', { hasText: 'Segundo destaque' })
      .first()
      .getByRole('button', { name: 'Adicionar' })
      .click();
    await page.getByRole('button', { name: 'Guardar ordem' }).click();

    await expect.poll(() => savedIds).toEqual(['e2e-featured-first', 'e2e-featured-next']);
  });

  test('shows selected businesses before active campaigns in the homepage rotation', async ({ page }) => {
    const business = createBusiness({
      id: 'e2e-homepage-featured',
      name: 'Destaque da Comunidade',
      homepageFeaturedOrder: 0,
    });
    const now = Date.now();
    const catalog = {
      ...DEFAULT_MONETIZATION_CATALOG,
      adCampaigns: [{
        ...DEFAULT_MONETIZATION_CATALOG.adCampaigns[0],
        id: 'e2e-homepage-campaign',
        title: 'Campanha depois do destaque',
        startsAt: new Date(now - 60_000).toISOString(),
        endsAt: new Date(now + 60_000).toISOString(),
        isActive: true,
      }],
    };
    await page.addInitScript((storedCatalog) => {
      window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
      window.localStorage.setItem('guigui_monetization_catalog', JSON.stringify(storedCatalog));
    }, catalog);
    await mockBusinessData(page, [business]);
    await page.route('**/api/app-state/guigui_monetization_catalog', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ key: 'guigui_monetization_catalog', value: catalog }),
    }));

    await page.goto('/');
    await expect(page.getByText('Empresa em destaque')).toBeVisible();
    await expect(page.getByText('Destaque da Comunidade')).toBeVisible();
    await page.getByRole('button', { name: 'Próximo destaque' }).click();
    await expect(page.getByText('Campanha depois do destaque')).toBeVisible();
    await expect(page.getByText('Publicidade — Comunidade Guigui')).toBeVisible();
  });
});
