import { defineConfig, devices } from '@playwright/test';

/**
 * A porta é configurável por PW_PORT (por omissão 3000). Existe porque outra
 * aplicação do ambiente local pode já estar a usar a 3000: sem isto, o
 * `reuseExistingServer` apontava os testes ao servidor alheio e os testes
 * falhavam por causa do sítio errado, não do código.
 */
const webPort = process.env.PW_PORT?.trim() || '3000';
const baseURL = `http://localhost:${webPort}`;

// Estes dois specs alteram o estado GLOBAL de publicação institucional: um
// publica documentos de teste e o outro despublica o site inteiro. Se os dois
// ficheiros correrem em workers diferentes ao mesmo tempo, a despublicação
// apanha o outro spec a meio e o resultado passa a depender do escalonamento.
// Ficam em projectos próprios e `institutional-public` depende de
// `institutional-policies`: o Playwright só arranca o segundo depois de o
// primeiro terminar, portanto nunca chegam a sobrepor-se.
const INSTITUTIONAL_STATE_SPECS = [
  /institutional-policies\.spec\.ts$/,
  /institutional-public\.spec\.ts$/,
  // O teste de restauro também publica (e repõe) o site institucional.
  /institutional-document-restore\.spec\.ts$/,
];

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
      // Os specs de publicação correm nos projectos dedicados abaixo.
      testIgnore: INSTITUTIONAL_STATE_SPECS,
    },
    {
      name: 'institutional-policies',
      testMatch: /institutional-policies\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'institutional-public',
      testMatch: /institutional-public\.spec\.ts$/,
      // Espera que a publicação de teste esteja concluída (e limpa) antes de
      // despublicar. Se o primeiro falhar, o segundo não corre sobre estado sujo.
      dependencies: ['institutional-policies'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'institutional-document-restore',
      testMatch: /institutional-document-restore\.spec\.ts$/,
      // O restauro publica o site, por isso corre depois de a despublicação
      // ter reposto a publicação; nunca em paralelo com ela.
      dependencies: ['institutional-public'],
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
