/**
 * Shared demo account fixtures for across test files
 * 
 * These accounts are pre-seeded in the development database and are used
 * by multiple E2E test files. Credentials are kept minimal for test reuse.
 * 
 * @see seed-demo.spec.ts for seed data origin
 */
export const DemoAccounts = {
  /** Citizen (citizen) demo account */
  citizen: {
    email: 'cidadao.seed01@guigui.test',
    password: 'Guigui2026!',
    name: 'Cidadão Teste',
  },

  /** Company (business) demo account */
  company: {
    email: 'empresa.seed01@guigui.test',
    password: 'Guigui2026!',
    name: 'Empresa Teste',
  },

  /** Admin demo account */
  admin: {
    email: 'admin.teste@guigui.com',
    password: 'Guigui2026!',
    role: 'admin' as const,
  },

  /** All demo accounts as a union type for test usage */
  get citizenEmail(): string {
    return this.citizen.email;
  },

  get companyEmail(): string {
    return this.company.email;
  },

  get adminEmail(): string {
    return this.admin.email;
  },

  get citizenPassword(): string {
    return this.citizen.password;
  },

  get companyPassword(): string {
    return this.company.password;
  },

  get adminPassword(): string {
    return this.admin.password;
  },
};

/**
 * Login helper using demo accounts
 * 
 * @param page - Playwright page
 * @param account - Which demo account to use (default: citizen)
 * @returns Promise resolving to the login response
 */
type DemoAccountKey = 'citizen' | 'company' | 'admin';

export async function loginWithDemoAccount(
  page: any,
  account: DemoAccountKey = 'citizen'
) {
  const credentials = DemoAccounts[account];
  await page.goto('/');

  const loginBtn = page.locator('button:has-text("Entrar"), a:has-text("Entrar")').first();
  if (await loginBtn.count()) {
    await loginBtn.click();
    await page.waitForTimeout(1000);
  }

  const emailInput = page.locator('input[type="email"]').first();
  const passwordInput = page.locator('input[type="password"]').first();

  if (await emailInput.count() && await passwordInput.count()) {
    await emailInput.fill(credentials.email);
    await passwordInput.fill(credentials.password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(2500);
  }

  return credentials;
}

/**
 * Login via API using demo accounts
 * 
 * @param account - Which demo account to use (default: citizen)
 * @returns Promise resolving to the API login response body
 */
export async function apiLoginWithDemoAccount(
  account: DemoAccountKey = 'citizen'
) {
  const credentials = DemoAccounts[account];
  const response = await fetch('http://127.0.0.1:3000/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API login failed: ${response.status} - ${errorBody}`);
  }

  return response.json();
}

export default DemoAccounts;