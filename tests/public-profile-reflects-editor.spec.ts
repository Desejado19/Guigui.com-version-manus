import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'Guigui@2026!';
const BUSINESS_EMAIL = 'empresa.teste@guigui.com';
const CITIZEN_EMAIL = 'cidadao.teste@guigui.com';

async function signIn(page: Page, email: string) {
  const response = await page.request.post('/api/auth/login', { data: { email, password: PASSWORD } });
  expect(response.ok(), await response.text()).toBeTruthy();
  const payload = await response.json();
  await page.addInitScript((user: any) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(user));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
  }, payload.user);
  return payload.user;
}

test('perfil público reflecte os dados guardados pelo editor da empresa', async ({ page }) => {
  const uniqueDescription = `DESCRICAO_PUBLICA_TESTE_${Date.now()}`;

  // 1. Login como empresa e guardar uma descrição única via API (editor).
  const businessUser = await signIn(page, BUSINESS_EMAIL);

  // Descobrir o id da empresa associada à conta.
  const businessesResponse = await page.request.get('/api/businesses');
  expect(businessesResponse.ok()).toBeTruthy();
  const businessesPayload = await businessesResponse.json();
  const businesses = businessesPayload.businesses || [];
  const targetBusiness = businesses.find((b: any) =>
    String(b.name || '').toLowerCase().includes('coqueiros')
  );
  expect(targetBusiness, 'empresa de teste não encontrada').toBeTruthy();
  const businessId = targetBusiness.id;

  const patchResponse = await page.request.patch(`/api/businesses/${businessId}/profile`, {
    data: { description: uniqueDescription },
  });
  expect(patchResponse.ok(), await patchResponse.text()).toBeTruthy();

  // 2. Login como cidadão e abrir o perfil público da empresa.
  await signIn(page, CITIZEN_EMAIL);
  await page.goto('/');

  const search = page.locator('.guigui-search input').first();
  await expect(search).toBeVisible({ timeout: 20_000 });
  await search.fill('Coqueiros');
  await page.locator('.guigui-search-button').first().click();

  const modal = page.locator('div.fixed.inset-0.z-50').first();
  await expect(modal).toBeVisible({ timeout: 20_000 });
  await expect(modal).toContainText(uniqueDescription, { timeout: 20_000 });
});