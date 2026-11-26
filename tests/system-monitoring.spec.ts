import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from './fixtures';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const ADMIN_EMAIL = 'admin.teste@guigui.com';
const ADMIN_PASSWORD = 'Guigui@2026!';
const PREFIX = `PW-SYS-${randomUUID().slice(0, 6)}`;
const INCIDENT_TITLE = `${PREFIX} verificação de monitorização`;
let db: Pool;

test.describe.configure({ mode: 'serial', timeout: 120_000 });

test.beforeAll(async () => {
  db = new Pool({ connectionString: process.env.DATABASE_URL });
});

test.afterAll(async () => {
  if (db) {
    const incidents = await db.query('SELECT id FROM system_incidents WHERE title LIKE $1', [`${PREFIX}%`]);
    const ids = incidents.rows.map((row) => row.id as string);
    if (ids.length > 0) {
      await db.query('DELETE FROM system_incident_events WHERE incident_id = ANY($1)', [ids]);
      await db.query('DELETE FROM system_incidents WHERE id = ANY($1)', [ids]);
    }
    // Restaura a configuração alterada pelo teste, se ficou alterada.
    await db.query(
      `UPDATE system_monitoring_settings SET interval_seconds=60 WHERE id=1 AND interval_seconds=120`,
    );
    await db.end();
  }
});

async function signIn(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  const response = await page.request.post('/api/auth/login', { data: { email, password } });
  const payload = await response.json().catch(() => ({}));
  expect(response.ok(), `login falhou: ${JSON.stringify(payload)}`).toBeTruthy();
  await page.addInitScript((account) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(account));
    window.localStorage.setItem('guigui_current_lang', 'pt');
  }, payload.user);
}

async function enterAdmin(page: Page) {
  await page.goto('/');
  if (!(await page.getByText('PAINEL ADMINISTRATIVO').count())) {
    await page.locator('button[title="Sessão Iniciada"]').first().click();
    await page.getByRole('button', { name: 'Administração Guigui.com' }).click();
  }
  await expect(page.getByText('PAINEL ADMINISTRATIVO').first()).toBeVisible({ timeout: 20_000 });
}

async function enterSystem(page: Page) {
  await enterAdmin(page);
  await page.locator('aside').getByRole('button', { name: /^(Sistema|System)/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Sistema', exact: true }).first()).toBeVisible({ timeout: 20_000 });
}

const systemNav = (page: Page) => page.getByRole('navigation', { name: 'Submódulos do Sistema' });

test('visão geral: KPIs reais, fontes e navegação dos dez submódulos', async ({ page }) => {
  await signIn(page);
  await enterSystem(page);

  const sections = [
    /Visão Geral/,
    /Infraestrutura/,
    /Recursos & Capacidade/,
    /Base de Dados/,
    /APIs & Integrações/,
    /Incidentes & Alertas/,
    /Logs & Diagnóstico/,
    /Disponibilidade/,
    /Segurança & Auditoria/,
    /Configurações/,
  ];
  for (const section of sections) {
    await expect(systemNav(page).getByRole('button', { name: section })).toBeVisible();
  }

  await expect(page.getByText('Estado global da plataforma')).toBeVisible();
  await expect(page.getByText('Indicadores e fontes')).toBeVisible();
  await expect(page.getByText('Componentes monitorizados')).toBeVisible();

  // Valores reais medidos pelo backend, não constantes decorativas.
  const overview = await page.request.get('/api/admin/system/overview');
  expect(overview.ok()).toBeTruthy();
  const body = await overview.json();
  expect(['operational', 'degraded', 'unavailable']).toContain(body.status);
  expect(body.services.total).toBeGreaterThan(0);
  expect(typeof body.process.pid).toBe('number');
  expect(typeof body.process.uptimeSeconds).toBe('number');
  expect(Array.isArray(body.metrics)).toBeTruthy();
  expect(body.metrics.some((metric: { key: string; status: string }) => metric.key === 'cpu' && metric.status === 'measured')).toBeTruthy();
  expect(body.metrics.some((metric: { key: string; status: string }) => metric.key === 'network' && metric.status === 'unavailable')).toBeTruthy();
});

test('infraestrutura: componentes, detalhe e limitações declaradas', async ({ page }) => {
  await signIn(page);
  await enterSystem(page);
  await systemNav(page).getByRole('button', { name: /Infraestrutura/ }).click();

  await expect(page.getByText('Componentes', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('PostgreSQL', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Pagamentos (Orange Money / Telecel)').first()).toBeVisible();

  await page.getByRole('button', { name: /PostgreSQL/ }).first().click();
  await expect(page.getByText(/Detalhe: PostgreSQL/)).toBeVisible();
  await expect(page.getByText('Métricas suportadas', { exact: true })).toBeVisible();
});

test('recursos: período funcional e séries reais de CPU/memória', async ({ page }) => {
  await signIn(page);
  await enterSystem(page);
  await systemNav(page).getByRole('button', { name: /Recursos & Capacidade/ }).click();

  await expect(page.getByText('CPU e memória')).toBeVisible();
  await expect(page.getByText('Métricas não suportadas')).toBeVisible();
  await expect(page.getByText(/Tráfego de rede por interface/)).toBeVisible();

  const responsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/admin/system/resources?hours=1') && response.request().method() === 'GET',
  );
  await page.getByLabel('Período').selectOption('1');
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.period.hours).toBe(1);
  expect(Array.isArray(body.series)).toBeTruthy();
});

test('base de dados: ligações, tabelas, locks e fontes indisponíveis explícitas', async ({ page }) => {
  await signIn(page);
  await enterSystem(page);
  await systemNav(page).getByRole('button', { name: /Base de Dados/ }).click();

  await expect(page.getByText('Tabelas com maior consumo')).toBeVisible();
  await expect(page.getByText('Locks e transações')).toBeVisible();
  await expect(page.getByText('Backups', { exact: true })).toBeVisible();

  const response = await page.request.get('/api/admin/system/database');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.connection.configured).toBe(true);
  expect(body.connection.connected).toBe(true);
  expect(body.tables.length).toBeGreaterThan(0);
  // A extensão pode não existir: nesse caso a API tem de dizer porquê.
  if (!body.slowQueries.available) {
    await expect(page.getByText(body.slowQueries.reason).first()).toBeVisible();
  }
});

test('APIs: volume por rota e integrações externas reais', async ({ page }) => {
  await signIn(page);
  await enterSystem(page);
  await systemNav(page).getByRole('button', { name: /APIs & Integrações/ }).click();

  await expect(page.getByText('Rotas com mais tráfego')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Integrações externas' })).toBeVisible();
  await expect(page.getByText('Todas as rotas')).toBeVisible();

  const response = await page.request.get('/api/admin/system/apis?days=1');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.totals.requests).toBeGreaterThan(0);
  expect(body.routes.length).toBeGreaterThan(0);
  expect(body.integrations.some((item: { id: string }) => item.id === 'payments')).toBeTruthy();
});

test('incidentes: criação manual, reconhecimento, resolução e persistência', async ({ page }) => {
  await signIn(page);
  await enterSystem(page);
  await systemNav(page).getByRole('button', { name: /Incidentes & Alertas/ }).click();

  await page.getByRole('button', { name: /Registar incidente/ }).click();
  const incidentForm = page.locator('form').filter({ hasText: 'Causa provável' });
  await incidentForm.getByLabel('Título *').fill(INCIDENT_TITLE);
  await incidentForm.getByLabel('Gravidade').selectOption('warning');
  await page.getByLabel('Descrição').fill('Incidente criado pelo teste Playwright para validar o fluxo real.');
  await page.getByLabel('Impacto').fill('Nenhum impacto funcional: teste controlado.');
  await page.getByRole('button', { name: 'Registar incidente', exact: true }).click();

  await expect(page.getByText(INCIDENT_TITLE).first()).toBeVisible({ timeout: 15_000 });

  // Persistência no PostgreSQL.
  const stored = await db.query('SELECT id, status FROM system_incidents WHERE title=$1', [INCIDENT_TITLE]);
  expect(stored.rowCount).toBe(1);
  const incidentId = stored.rows[0].id as string;
  expect(stored.rows[0].status).toBe('open');

  // Filtro por estado aplicado no backend.
  await page.getByLabel('Estado').selectOption('open');
  const filtered = page.waitForResponse((response) =>
    response.url().includes('/api/admin/system/incidents?status=open'),
  );
  await page.getByRole('button', { name: /Aplicar/ }).click();
  await filtered;

  await page.getByRole('button', { name: new RegExp(INCIDENT_TITLE) }).first().click();
  await expect(page.getByText(`Incidente ${incidentId}`)).toBeVisible();
  await expect(page.getByText('Histórico', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Resolver incidente' }).click();
  await expect.poll(async () => {
    const row = await db.query('SELECT status, resolved_at FROM system_incidents WHERE id=$1', [incidentId]);
    return row.rows[0]?.status;
  }).toBe('resolved');
  const resolved = await db.query('SELECT resolution, resolved_at FROM system_incidents WHERE id=$1', [incidentId]);
  expect(resolved.rows[0].resolved_at).not.toBeNull();
});

test('logs: filtros funcionam e um erro real gera registo correlacionável', async ({ page }) => {
  await signIn(page);
  // Gera um 404 real numa rota da API: o middleware persiste o log com o request id.
  const probe = await page.request.get('/api/admin/system/incidents/SYS-INEXISTENTE-PLAYWRIGHT');
  expect(probe.status()).toBe(404);
  const requestId = probe.headers()['x-request-id'];
  expect(requestId).toBeTruthy();
  await expect.poll(async () => {
    const correlated = await page.request.get(`/api/admin/system/logs?hours=1&requestId=${requestId}`);
    const payload = await correlated.json();
    return payload.logs.length;
  }, { timeout: 10_000 }).toBeGreaterThan(0);

  await enterSystem(page);
  await systemNav(page).getByRole('button', { name: /Logs & Diagnóstico/ }).click();
  await expect(page.getByRole('heading', { name: 'Logs técnicos', exact: true })).toBeVisible();

  const response = await page.request.get('/api/admin/system/logs?level=warn&hours=1');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.logs.length).toBeGreaterThan(0);
  expect(body.logs.every((log: { level: string }) => log.level === 'warn')).toBeTruthy();

  await page.getByLabel('Nível').selectOption('warn');
  const filtered = page.waitForResponse((item) =>
    item.url().includes('/api/admin/system/logs') && item.url().includes('level=warn'),
  );
  await page.getByRole('button', { name: /Filtrar/ }).click();
  await filtered;
  await expect(page.getByRole('heading', { name: 'Logs técnicos', exact: true })).toBeVisible();
});

test('disponibilidade: períodos, SLO e incidentes reais', async ({ page }) => {
  await signIn(page);
  await enterSystem(page);
  await systemNav(page).getByRole('button', { name: /Disponibilidade/ }).click();

  await expect(page.getByText('Objetivo de nível de serviço (SLO)')).toBeVisible();
  await expect(page.getByText('Incidentes (30 dias)')).toBeVisible();

  const response = await page.request.get('/api/admin/system/availability');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.periods).toHaveLength(3);
  expect(typeof body.slo.target).toBe('number');
  expect(body.slo.note).toContain('amostras');
});

test('segurança: eventos de auditoria reais', async ({ page }) => {
  await signIn(page);
  await enterSystem(page);
  await systemNav(page).getByRole('button', { name: /Segurança & Auditoria/ }).click();

  await expect(page.getByText('Ações mais frequentes')).toBeVisible();
  await expect(page.getByText('Eventos recentes')).toBeVisible();
  await expect(page.getByText('Falhas de login')).toBeVisible();

  const response = await page.request.get('/api/admin/system/security?days=1');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.source).toContain('audit_logs');
  expect(body.summary).not.toBeNull();
});

test('configurações: guardar altera o valor persistido e é aplicado', async ({ page }) => {
  await signIn(page);
  await enterSystem(page);
  await systemNav(page).getByRole('button', { name: /Configurações/ }).click();

  const interval = page.getByLabel(/Intervalo de recolha/);
  await expect(interval).toHaveValue('60');
  await interval.fill('120');
  const saved = page.waitForResponse((response) =>
    response.url().includes('/api/admin/system/settings') && response.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: /Guardar configuração/ }).click();
  const response = await saved;
  expect(response.ok()).toBeTruthy();
  await expect(page.getByText(/Configuração guardada e aplicada/)).toBeVisible();

  const persisted = await db.query('SELECT interval_seconds FROM system_monitoring_settings WHERE id=1');
  expect(Number(persisted.rows[0].interval_seconds)).toBe(120);

  // Restaura o valor operacional por omissão.
  await interval.fill('60');
  await page.getByRole('button', { name: /Guardar configuração/ }).click();
  await expect.poll(async () => {
    const row = await db.query('SELECT interval_seconds FROM system_monitoring_settings WHERE id=1');
    return Number(row.rows[0]?.interval_seconds);
  }).toBe(60);
});

test('autorização: APIs do Sistema recusam cidadãos e pedidos sem sessão', async ({ page, request }) => {
  const anonymous = await request.get('/api/admin/system/overview');
  expect([401, 403]).toContain(anonymous.status());

  await signIn(page, 'cidadao.teste@guigui.com', 'Guigui@2026!');
  const citizen = await page.request.get('/api/admin/system/overview');
  expect([401, 403]).toContain(citizen.status());

  // Escrita também exige administração.
  const write = await page.request.post('/api/admin/system/incidents', { data: { title: 'negado' } });
  expect([401, 403]).toContain(write.status());
});

test('navegação completa sem erros JS nem respostas 5xx', async ({ page }) => {
  const pageErrors: string[] = [];
  const serverErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  page.on('response', (response) => {
    if (response.url().includes('/api/admin/system/') && response.status() >= 500) {
      serverErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  await signIn(page);
  await enterSystem(page);

  for (const section of [
    /Infraestrutura/,
    /Recursos & Capacidade/,
    /Base de Dados/,
    /APIs & Integrações/,
    /Incidentes & Alertas/,
    /Logs & Diagnóstico/,
    /Disponibilidade/,
    /Segurança & Auditoria/,
    /Configurações/,
    /Visão Geral/,
  ]) {
    await systemNav(page).getByRole('button', { name: section }).click();
    await page.waitForTimeout(500);
  }

  expect(pageErrors, `erros JS: ${pageErrors.join(' | ')}`).toEqual([]);
  expect(serverErrors, `respostas 5xx: ${serverErrors.join(' | ')}`).toEqual([]);
});
