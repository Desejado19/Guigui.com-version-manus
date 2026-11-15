#!/usr/bin/env tsx
/**
 * Auditoria de persistência e isolamento do estado da aplicação.
 *
 * Verifica, contra o servidor e a base PostgreSQL reais:
 * - gravação de estado devolve versão (`updatedAt`) e a linha da BD coincide;
 * - uma segunda gravação produz uma versão mais recente;
 * - leitura devolve o valor persistido;
 * - uma empresa não consegue gravar a preferência de um cidadão;
 * - uma empresa não consegue gravar conversas (dados privados da plataforma);
 * - conversas devolvidas a cada perfil pertencem apenas a esse perfil.
 */
import 'dotenv/config';
import { Pool } from 'pg';

const BASE = (process.env.APP_STATE_TEST_BASE || 'http://127.0.0.1:3000').replace(/\/$/, '');
const TAG = `APPTEST-${Date.now()}`;
const CITIZEN = { email: 'cidadao@guigui.com', password: '123456' };
const BUSINESS = { email: 'empresa.teste@guigui.com', password: 'Guigui@2026!' };

let passed = 0;
let failed = 0;

function check(condition: unknown, label: string, detail?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${label}`, detail ?? '');
  }
}

async function login(email: string, password: string): Promise<{ cookie: string; user: any }> {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Login ${email} falhou (${response.status}): ${data?.error || 'sem detalhe'}`);
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  const raw = cookies[0] || response.headers.get('set-cookie') || '';
  const cookie = raw.split(';')[0];
  if (!cookie) throw new Error(`Login ${email} não devolveu cookie de sessão.`);
  return { cookie, user: data.user };
}

async function api(path: string, cookie: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', cookie, ...(init.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function main(): Promise<void> {
  console.log(`Auditoria de persistência app-state — ${TAG}`);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const citizen = await login(CITIZEN.email, CITIZEN.password);
  const business = await login(BUSINESS.email, BUSINESS.password);
  const key = `user_language_${citizen.user.id}`;
  const original = await pool.query('SELECT value FROM app_state WHERE key=$1', [key]);

  try {
    const firstValue = { language: 'pt', marker: `${TAG}-1` };
    const first = await api(`/api/app-state/${encodeURIComponent(key)}`, citizen.cookie, {
      method: 'POST',
      body: JSON.stringify({ value: firstValue }),
    });
    check(first.status === 200, 'cidadão grava estado (200)', first);
    check(typeof first.data?.updatedAt === 'string' && first.data.updatedAt.length > 0, 'servidor devolve versão updatedAt', first.data);

    const dbFirst = await pool.query('SELECT value, updated_at FROM app_state WHERE key=$1', [key]);
    check(dbFirst.rows[0]?.value?.marker === firstValue.marker, 'valor existe na tabela app_state', dbFirst.rows[0]?.value);
    check(
      dbFirst.rows[0]?.updated_at && new Date(dbFirst.rows[0].updated_at).toISOString() === first.data.updatedAt,
      'versão devolvida coincide com updated_at da BD',
      { db: dbFirst.rows[0]?.updated_at, api: first.data.updatedAt },
    );

    const readBack = await api(`/api/app-state/${encodeURIComponent(key)}`, citizen.cookie);
    check(readBack.status === 200 && readBack.data?.value?.marker === firstValue.marker, 'leitura devolve o valor persistido', readBack.data);

    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await api(`/api/app-state/${encodeURIComponent(key)}`, citizen.cookie, {
      method: 'POST',
      body: JSON.stringify({ value: { language: 'pt', marker: `${TAG}-2` } }),
    });
    check(second.status === 200, 'segunda gravação aceite', second);
    check(
      second.data?.updatedAt && first.data?.updatedAt && second.data.updatedAt > first.data.updatedAt,
      'segunda gravação produz versão mais recente',
      { first: first.data?.updatedAt, second: second.data?.updatedAt },
    );
    const dbSecond = await pool.query('SELECT value FROM app_state WHERE key=$1', [key]);
    check(dbSecond.rows[0]?.value?.marker === `${TAG}-2`, 'BD guarda o valor mais recente', dbSecond.rows[0]?.value);

    const foreignWrite = await api(`/api/app-state/${encodeURIComponent(key)}`, business.cookie, {
      method: 'POST',
      body: JSON.stringify({ value: { language: 'fr', marker: `${TAG}-forged` } }),
    });
    check(foreignWrite.status === 403, 'empresa não grava estado de um cidadão (403)', foreignWrite);

    const conversationsWrite = await api('/api/app-state/guigui_conversations', business.cookie, {
      method: 'POST',
      body: JSON.stringify({ value: [] }),
    });
    check(conversationsWrite.status === 403, 'empresa não grava conversas privadas (403)', conversationsWrite);

    const citizenConversations = await api('/api/app-state/guigui_conversations', citizen.cookie);
    const citizenRows: any[] = Array.isArray(citizenConversations.data?.value) ? citizenConversations.data.value : [];
    check(
      citizenRows.every((row) => row.userId === citizen.user.id),
      'cidadão só lê conversas próprias',
      { count: citizenRows.length },
    );

    const businessConversations = await api('/api/app-state/guigui_conversations', business.cookie);
    const businessRows: any[] = Array.isArray(businessConversations.data?.value) ? businessConversations.data.value : [];
    check(
      businessRows.every((row) => row.businessId === business.user.businessId),
      'empresa só lê conversas da sua empresa',
      { count: businessRows.length, businessId: business.user.businessId },
    );

    console.log(`\nResultado: ${passed} aprovados, ${failed} falhados.`);
  } finally {
    try {
      if (original.rows[0]) {
        await pool.query('UPDATE app_state SET value=$2::jsonb, updated_at=NOW() WHERE key=$1', [key, JSON.stringify(original.rows[0].value)]);
      } else {
        await pool.query('DELETE FROM app_state WHERE key=$1', [key]);
      }
      console.log('Preferência original restaurada.');
    } catch (cleanupError) {
      console.error('Falha ao restaurar o estado original:', cleanupError);
    }
    await pool.end();
  }

  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error('Auditoria interrompida:', error instanceof Error ? error.message : error);
  process.exit(1);
});
