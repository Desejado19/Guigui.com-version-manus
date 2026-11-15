import { expect, test, type APIRequestContext } from '@playwright/test';
import http from 'node:http';

/**
 * ESCOPO DOS SINAIS DE TEMPO REAL.
 *
 * O canal `/api/conversations/events` já chegou a escrever cada evento em todas
 * as ligações SSE abertas: um cidadão recebia sinais (IDs e tipo de actividade)
 * de conversas e tickets de terceiros. Este teste fixa o contrato:
 *
 * - quem participa na conversa/ticket recebe o sinal;
 * - um cidadão sem relação com essa conversa/ticket não recebe nada;
 * - a administração recebe sinais de suporte (gere os pedidos) mas não de
 *   conversas comerciais, que nem sequer lhe são expostas pela API;
 * - o payload entregue ao browser não transporta os identificadores internos
 *   usados para o encaminhamento (`userId`/`businessId`).
 */

const BASE_URL = process.env.PW_BASE_URL?.trim() || `http://127.0.0.1:${process.env.PW_PORT?.trim() || '3000'}`;
const { hostname, port } = new URL(BASE_URL);
const CITIZEN = { email: 'cidadao.teste@guigui.com', password: 'Guigui@2026!' };
const OUTSIDER = { email: 'cidadao.seed02@guigui.test', password: 'Guigui2026!' };
const ADMIN = { email: 'admin.teste@guigui.com', password: 'Guigui2026!' };

type Stream = {
  /** Resolve com o código HTTP assim que os headers da ligação chegam. */
  opened: Promise<number>;
  ready: Promise<void>;
  events: Array<{ name: string; data: string }>;
  close: () => void;
};

async function signIn(request: APIRequestContext, account: { email: string; password: string }): Promise<string> {
  const response = await request.post(`${BASE_URL}/api/auth/login`, { data: account });
  expect(response.ok(), `login de ${account.email}`).toBeTruthy();
  const setCookie = response.headers()['set-cookie'] ?? '';
  const match = setCookie.match(/guigui_session=([^;]+)/);
  expect(match, `cookie de sessão de ${account.email}`).toBeTruthy();
  return `guigui_session=${match![1]}`;
}

function openStream(cookie: string): Stream {
  const events: Array<{ name: string; data: string }> = [];
  let markReady: () => void = () => {};
  let markOpened: (status: number) => void = () => {};
  const ready = new Promise<void>((resolve) => { markReady = resolve; });
  const opened = new Promise<number>((resolve) => { markOpened = resolve; });
  let buffer = '';

  const request = http.get(
    { hostname, port: Number(port || 80), path: '/api/conversations/events', headers: { Accept: 'text/event-stream', Cookie: cookie } },
    (response) => {
      markOpened(response.statusCode ?? 0);
      response.setEncoding('utf8');
      response.on('data', (chunk: string) => {
        buffer += chunk;
        if (buffer.includes('event: ready')) markReady();
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';
        for (const block of blocks) {
          const name = block.match(/^event: (.+)$/m)?.[1];
          const data = block.match(/^data: (.+)$/m)?.[1];
          if (name && data) events.push({ name, data });
        }
      });
    },
  );
  request.on('error', () => undefined);

  return { opened, ready, events, close: () => request.destroy() };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Espera até aparecer o evento pedido; devolve `null` se não chegar a tempo. */
async function waitForEvent(stream: Stream, name: string, timeoutMs = 4000): Promise<{ name: string; data: string } | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = stream.events.find((event) => event.name === name);
    if (found) return found;
    await sleep(100);
  }
  return null;
}

test.describe('Escopo dos sinais de conversas e tickets', () => {
  test.describe.configure({ mode: 'serial', timeout: 60_000 });

  test('conversa: só os participantes recebem o sinal', async ({ request }) => {
    const [citizenCookie, outsiderCookie, adminCookie] = await Promise.all([
      signIn(request, CITIZEN),
      signIn(request, OUTSIDER),
      signIn(request, ADMIN),
    ]);

    const conversations = await (await request.get(`${BASE_URL}/api/conversations`, { headers: { Cookie: citizenCookie } })).json() as {
      conversations: Array<{ id: string }>;
    };
    expect(conversations.conversations.length, 'o cidadão de teste tem conversas').toBeGreaterThan(0);
    const conversationId = conversations.conversations[0].id;

    const citizen = openStream(citizenCookie);
    const outsider = openStream(outsiderCookie);
    const admin = openStream(adminCookie);
    try {
      expect(await citizen.opened, 'handshake SSE do participante').toBe(200);
      expect(await outsider.opened, 'handshake SSE do cidadão externo').toBe(200);
      expect(await admin.opened, 'handshake SSE da administração').toBe(200);
      await Promise.all([citizen.ready, outsider.ready, admin.ready]);

      const marked = await request.post(`${BASE_URL}/api/conversations/${encodeURIComponent(conversationId)}/read`, {
        headers: { Cookie: citizenCookie },
      });
      expect(marked.ok(), 'marcar a conversa como lida').toBeTruthy();

      const received = await waitForEvent(citizen, 'conversation');
      expect(received, 'o participante recebe o sinal da sua conversa').toBeTruthy();
      const payload = JSON.parse(received!.data) as Record<string, unknown>;
      expect(payload.conversationId).toBe(conversationId);
      expect(Object.keys(payload).sort(), 'payload sem identificadores internos de encaminhamento').toEqual(['conversationId', 'type']);

      await sleep(1500);
      expect(outsider.events.filter((event) => event.name === 'conversation'), 'cidadão externo não recebe sinais').toHaveLength(0);
      expect(admin.events.filter((event) => event.name === 'conversation'), 'administração não recebe conversas comerciais').toHaveLength(0);
    } finally {
      citizen.close();
      outsider.close();
      admin.close();
    }
  });

  test('ticket de suporte: requerente e administração sim, externos não', async ({ request }) => {
    const [citizenCookie, outsiderCookie, adminCookie] = await Promise.all([
      signIn(request, CITIZEN),
      signIn(request, OUTSIDER),
      signIn(request, ADMIN),
    ]);

    const mine = await (await request.get(`${BASE_URL}/api/support/tickets/mine`, { headers: { Cookie: citizenCookie } })).json() as {
      tickets: Array<{ id: string; status: string }>;
    };
    let ticket = mine.tickets[0];
    if (!ticket) {
      const created = await request.post(`${BASE_URL}/api/support/tickets`, {
        headers: { Cookie: citizenCookie },
        data: {
          subject: `Regressão de escopo em tempo real ${Date.now()}`,
          description: 'Pedido criado pelo teste automático do escopo do canal de tempo real.',
          category: 'other',
        },
      });
      expect(created.status(), 'criar ticket de teste').toBe(201);
      ticket = (await created.json() as { ticket: { id: string; status: string } }).ticket;
    }

    const citizen = openStream(citizenCookie);
    const outsider = openStream(outsiderCookie);
    const admin = openStream(adminCookie);
    try {
      expect(await citizen.opened, 'handshake SSE do requerente').toBe(200);
      expect(await outsider.opened, 'handshake SSE do cidadão externo').toBe(200);
      expect(await admin.opened, 'handshake SSE da administração').toBe(200);
      await Promise.all([citizen.ready, outsider.ready, admin.ready]);

      // Estado repetido: exercita o sinal sem alterar o conteúdo do ticket.
      const updated = await request.post(`${BASE_URL}/api/support/tickets/${encodeURIComponent(ticket.id)}/status`, {
        headers: { Cookie: adminCookie },
        data: { status: ticket.status || 'open' },
      });
      expect(updated.ok(), 'administração mantém o estado do ticket').toBeTruthy();

      expect(await waitForEvent(citizen, 'support'), 'o requerente recebe o sinal do seu ticket').toBeTruthy();
      expect(await waitForEvent(admin, 'support'), 'a administração recebe sinais de suporte').toBeTruthy();

      await sleep(1500);
      expect(outsider.events.filter((event) => event.name === 'support'), 'cidadão externo não recebe sinais de suporte').toHaveLength(0);
    } finally {
      citizen.close();
      outsider.close();
      admin.close();
    }
  });
});
