import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// A exportação agrega no PostgreSQL. Aqui a fonte de dados é substituída por
// uma implementação controlada (sem base de dados real), mantendo a rota, a
// autenticação, a autorização e a formatação CSV verdadeiras.
const exportSpy = vi.hoisted(() => vi.fn());
const eventTitleSpy = vi.hoisted(() => vi.fn());

vi.mock('../../server/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/db')>();
  // A rota só trata a exportação quando `databaseConfigured` é verdadeiro; a
  // sessão/identidade continuam no repositório JSON porque o pool é nulo.
  return { ...actual, databaseConfigured: true, databasePool: null };
});

vi.mock('../../server/modules/identity-access/infrastructure/postgresIdentityRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/modules/identity-access/infrastructure/postgresIdentityRepository')>();
  const { createJsonIdentityRepository } = await import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository');
  return { ...actual, createPostgresIdentityRepository: () => createJsonIdentityRepository() };
});

vi.mock('../../server/postgresTicketLifecycleService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/postgresTicketLifecycleService')>();
  return {
    ...actual,
    exportPostgresTicketsByBuyer: exportSpy,
    findPostgresEventTitleForCompany: eventTitleSpy,
  };
});

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guigui-tickets-export-'));
process.env.GUIGUI_DATA_DIR = tempDir;
process.env.DATABASE_URL = '';
process.env.NODE_ENV = 'production';
process.env.VERCEL = '1';
process.env.PORT = '0';
process.env.ENABLE_DEMO_ACCOUNTS = 'false';
process.env.SESSION_COOKIE_SECRET = 'tickets-export-test-session-secret';
process.env.TICKET_SIGNING_SECRET = 'tickets-export-test-ticket-secret';
process.env.PAYMENT_WEBHOOK_SECRET = 'tickets-export-test-payment-secret';
process.env.SCANNER_DOOR_CODE = 'TEST-DOOR';

const PASSWORD = 'CorrectHorse42';
const BUSINESS_EMAIL = 'empresa-export@test.guigui';
const ADMIN_EMAIL = 'admin-export@test.guigui';

let server: Server;
let baseUrl: string;
let auth: typeof import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository');

async function login(email: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  expect(response.status, payload.error).toBe(200);
  const cookie = response.headers.get('set-cookie');
  expect(cookie).toBeTruthy();
  return cookie!.split(';')[0];
}

async function getExport(query: string, cookie?: string) {
  return fetch(`${baseUrl}/api/tickets/sold/export${query}`, {
    headers: cookie ? { Cookie: cookie } : undefined,
  });
}

function parseCsvRows(body: string): string[][] {
  const withoutBom = body.replace(/^\uFEFF/, '');
  return withoutBom
    .split('\r\n')
    .filter(Boolean)
    .map((line) => line.slice(1, -1).split('";"'));
}

// Agregação que a base devolveria: o mesmo comprador com dois tipos de bilhete.
const AGGREGATED_FIXTURE = [
  { buyerName: 'Ana Silva', buyerPhone: '+245955000001', ticketTypeName: 'VIP', eventId: 'evt-da-empresa', eventTitle: 'Festa da Empresa', quantity: 2, totalXOF: 40000, paid: true, pending: false, cancelled: false },
  { buyerName: 'Ana Silva', buyerPhone: '+245955000001', ticketTypeName: 'Geral', eventId: 'evt-da-empresa', eventTitle: 'Festa da Empresa', quantity: 1, totalXOF: 10000, paid: true, pending: false, cancelled: false },
  { buyerName: 'Bruno Gomes', buyerPhone: '', ticketTypeName: 'VIP', eventId: 'evt-da-empresa', eventTitle: 'Festa da Empresa', quantity: 1, totalXOF: 0, paid: false, pending: true, cancelled: false },
];

// Exportação sem eventId: todos os eventos da empresa, cada comprador por evento.
const ALL_EVENTS_FIXTURE = [
  { buyerName: 'Ana Silva', buyerPhone: '+245955000001', ticketTypeName: 'VIP', eventId: 'evt-da-empresa', eventTitle: 'Festa da Empresa', quantity: 1, totalXOF: 20000, paid: true, pending: false, cancelled: false },
  { buyerName: 'Ana Silva', buyerPhone: '+245955000001', ticketTypeName: 'Geral', eventId: 'evt-concerto', eventTitle: 'Concerto de Verão', quantity: 2, totalXOF: 30000, paid: true, pending: false, cancelled: false },
  { buyerName: 'Bruno Gomes', buyerPhone: '', ticketTypeName: 'VIP', eventId: 'evt-concerto', eventTitle: 'Concerto de Verão', quantity: 1, totalXOF: 0, paid: false, pending: true, cancelled: false },
];

beforeAll(async () => {
  const { default: app } = await import('../../server');
  auth = await import('../../server/modules/identity-access/infrastructure/jsonIdentityRepository');

  auth.createUser({
    name: 'Empresa Exportação', email: BUSINESS_EMAIL, password: PASSWORD, role: 'business',
    phone: '+245955000010', neighborhood: 'Bissau', businessId: 'biz-export', businessName: 'Empresa Exportação',
  });
  auth.createUser({
    name: 'Admin Exportação', email: ADMIN_EMAIL, password: PASSWORD, role: 'admin',
    phone: '+245955000011', neighborhood: 'Bissau',
  });

  server = (app as Express).listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

beforeEach(() => {
  exportSpy.mockReset();
  eventTitleSpy.mockReset();
  eventTitleSpy.mockResolvedValue(null);
  // Simula o âmbito da base: só existem eventos desta empresa; sem eventId
  // devolve todos eles.
  exportSpy.mockImplementation(async (companyId: string, eventId?: string) => {
    if (companyId !== 'biz-export') return [];
    if (eventId === 'evt-da-empresa') return AGGREGATED_FIXTURE;
    if (eventId === undefined) return ALL_EVENTS_FIXTURE;
    return [];
  });
});

describe('GET /api/tickets/sold/export', () => {
  it('devolve 401 sem sessão', async () => {
    const response = await getExport('');
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
    expect(exportSpy).not.toHaveBeenCalled();
  });

  it('devolve 400 a um admin sem companyId', async () => {
    const cookie = await login(ADMIN_EMAIL);
    const response = await getExport('', cookie);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: 'COMPANY_REQUIRED' });
    expect(exportSpy).not.toHaveBeenCalled();
  });

  it('exporta CSV agregado por comprador com quantidade, tipos e total', async () => {
    const cookie = await login(BUSINESS_EMAIL);
    const response = await getExport('?eventId=evt-da-empresa', cookie);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('cache-control')).toBe('no-store');

    const rows = parseCsvRows(await response.text());
    expect(rows[0]).toEqual(['Comprador', 'Telefone', 'Bilhetes', 'Tipos de bilhete', 'Total pago (XOF)', 'Estado']);

    const ana = rows.find((row) => row[0] === 'Ana Silva');
    expect(ana).toEqual(['Ana Silva', '+245955000001', '3', 'VIP x2 + Geral x1', '50000', 'Pago']);

    const bruno = rows.find((row) => row[0] === 'Bruno Gomes');
    expect(bruno).toEqual(['Bruno Gomes', '—', '1', 'VIP x1', '0', 'Pendente']);

    // A empresa vem sempre da sessão, nunca de um parâmetro do pedido.
    expect(exportSpy).toHaveBeenCalledWith('biz-export', 'evt-da-empresa');
  });

  it('sem eventId exporta todos os eventos com uma coluna com o nome do evento', async () => {
    const cookie = await login(BUSINESS_EMAIL);
    const response = await getExport('', cookie);

    expect(response.status).toBe(200);
    const filename = response.headers.get('content-disposition') || '';
    expect(filename).toContain('compradores-todos-os-eventos-');

    const rows = parseCsvRows(await response.text());
    expect(rows[0]).toEqual(['Comprador', 'Telefone', 'Evento', 'Bilhetes', 'Tipos de bilhete', 'Total pago (XOF)', 'Estado']);

    // O mesmo comprador aparece uma vez por evento, com o evento identificado.
    expect(rows.filter((row) => row[0] === 'Ana Silva')).toEqual([
      ['Ana Silva', '+245955000001', 'Concerto de Verão', '2', 'Geral x2', '30000', 'Pago'],
      ['Ana Silva', '+245955000001', 'Festa da Empresa', '1', 'VIP x1', '20000', 'Pago'],
    ]);
    expect(rows.find((row) => row[0] === 'Bruno Gomes')).toEqual(
      ['Bruno Gomes', '—', 'Concerto de Verão', '1', 'VIP x1', '0', 'Pendente'],
    );

    expect(exportSpy).toHaveBeenCalledWith('biz-export', undefined);
  });

  it('exporta todos os compradores de um evento com mais de 500 bilhetes, agregados', async () => {
    // 651 bilhetes: 520 compradores com 1 bilhete + Ana com 131 bilhetes em dois
    // tipos. A vista paginada pararia nas 500 linhas; a exportação não.
    const bulkRows = Array.from({ length: 520 }, (_, index) => ({
      buyerName: `Comprador ${String(index + 1).padStart(3, '0')}`,
      buyerPhone: `+245955${String(index + 1).padStart(6, '0')}`,
      ticketTypeName: 'Geral',
      eventId: 'evt-grande',
      eventTitle: 'Festival Grande',
      quantity: 1,
      totalXOF: 5000,
      paid: true,
      pending: false,
      cancelled: false,
    }));
    bulkRows.push(
      { buyerName: 'Ana Silva', buyerPhone: '+245955000001', ticketTypeName: 'Geral', eventId: 'evt-grande', eventTitle: 'Festival Grande', quantity: 100, totalXOF: 500000, paid: true, pending: false, cancelled: false },
      { buyerName: 'Ana Silva', buyerPhone: '+245955000001', ticketTypeName: 'VIP', eventId: 'evt-grande', eventTitle: 'Festival Grande', quantity: 31, totalXOF: 465000, paid: true, pending: false, cancelled: false },
    );
    exportSpy.mockResolvedValue(bulkRows);

    const cookie = await login(BUSINESS_EMAIL);
    const response = await getExport('?eventId=evt-grande', cookie);

    expect(response.status).toBe(200);
    const rows = parseCsvRows(await response.text());
    const dataRows = rows.slice(1);

    // Mais de 500 compradores exportados: nada foi truncado no limite da lista.
    expect(dataRows.length).toBe(521);
    expect(dataRows.length).toBeGreaterThan(500);
    expect(dataRows.map((row) => row[0])).toContain('Comprador 520');

    // Agregação por comprador: quantidade, tipos e total somados.
    expect(dataRows.find((row) => row[0] === 'Ana Silva')).toEqual([
      'Ana Silva', '+245955000001', '131', 'Geral x100 + VIP x31', '965000', 'Pago',
    ]);
    expect(exportSpy).toHaveBeenCalledWith('biz-export', 'evt-grande');
  });

  it('não exporta bilhetes de um evento de outra empresa', async () => {
    const cookie = await login(BUSINESS_EMAIL);
    // `companyId` no pedido é ignorado: a empresa continua a ser a da sessão.
    const response = await getExport('?eventId=evt-de-outra-empresa&companyId=outra-empresa', cookie);

    expect(response.status).toBe(200);
    const rows = parseCsvRows(await response.text());
    expect(rows).toHaveLength(1); // apenas o cabeçalho
    expect(rows[0]).toEqual(['Comprador', 'Telefone', 'Bilhetes', 'Tipos de bilhete', 'Total pago (XOF)', 'Estado']);
    expect(exportSpy).toHaveBeenCalledWith('biz-export', 'evt-de-outra-empresa');
  });
});
