import { defineConfig, devices } from '@playwright/test';

/**
 * A porta é configurável por PW_PORT (por omissão 3000). Existe porque outra
 * aplicação do ambiente local pode já estar a usar a 3000: sem isto, o
 * `reuseExistingServer` apontava os testes ao servidor alheio e os testes
 * falhavam por causa do sítio errado, não do código.
 */
const webPort = process.env.PW_PORT?.trim() || '3000';
const baseURL = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: './tests',
  testMatch: 'tests/*.spec.ts',
  testIgnore: ['**/unit/**'],
  fullyParallel: true,
  // Os testes de responsividade, tema escuro, i18n e dashboards visuais
  // autenticam contas de demonstração partilhadas e percorrem o painel inteiro
  // de cada vez. Com o valor por omissão (um worker por CPU), vários browsers
  // batem no servidor de desenvolvimento single-process ao mesmo tempo, o Vite
  // middleware recompila a aplicação sob pressão e o servidor chega a cortar
  // ligações (ECONNRESET/ECONNREFUSED) — o teste falha pelo ambiente, não pelo
  // código. Dois workers mantêm o paralelismo sem sobrecarregar o servidor.
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  // webServer desabilitado: servidor de produção já está rodando na porta 3000
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
