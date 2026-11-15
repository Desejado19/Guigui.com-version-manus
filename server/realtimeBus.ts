import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { databasePool } from './db';

/**
 * Canal de tempo real partilhado entre instâncias.
 *
 * O Guigui.com serve as ligações SSE a partir da memória de cada processo, por
 * isso um evento gerado numa instância só chegava aos clientes dessa instância.
 * Aqui os eventos são publicados no PostgreSQL (`NOTIFY`) e cada processo tem
 * uma ligação dedicada em `LISTEN`: todas as instâncias recebem o mesmo evento
 * e reencaminham-no para as suas próprias ligações SSE.
 *
 * Regras:
 * - A base de dados é a fonte de verdade; o canal transporta apenas um sinal
 *   (`type` + `payload`) depois de a escrita estar confirmada.
 * - Cada evento tem um identificador único e é entregue uma só vez por
 *   processo (deduplicação), mesmo que a instância receba o seu próprio NOTIFY.
 * - Sem PostgreSQL configurado (modo memória) o canal continua a funcionar
 *   dentro do processo, para não partir o ambiente de demonstração.
 */

export const REALTIME_CHANNEL = 'guigui_realtime';

const MAX_SEEN_EVENTS = 2000;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 10_000;

export interface RealtimeEnvelope {
  /** Identificador único do evento: permite deduplicar entregas. */
  id: string;
  type: string;
  payload: Record<string, unknown>;
  publishedAt: string;
  /** Instância que publicou (diagnóstico). */
  origin: string;
}

type RealtimeHandler = (envelope: RealtimeEnvelope) => void;

const instanceId = `${process.pid}-${randomUUID().slice(0, 8)}`;
const emitter = new EventEmitter();
emitter.setMaxListeners(50);

const seenOrder: string[] = [];
const seen = new Set<string>();

const counters = {
  published: 0,
  received: 0,
  duplicatesDropped: 0,
  publishErrors: 0,
  listenErrors: 0,
  reconnects: 0,
  connected: false,
  mode: databasePool ? 'postgres' : 'memory',
  lastEventAt: null as string | null,
  lastLatencyMs: null as number | null,
};

/** Evita aplicar duas vezes o mesmo evento (eco do próprio NOTIFY incluído). */
function isDuplicate(id: string): boolean {
  if (!id) return false;
  if (seen.has(id)) return true;
  seen.add(id);
  seenOrder.push(id);
  while (seenOrder.length > MAX_SEEN_EVENTS) {
    const oldest = seenOrder.shift();
    if (oldest) seen.delete(oldest);
  }
  return false;
}

function dispatch(envelope: RealtimeEnvelope): void {
  if (isDuplicate(envelope.id)) {
    counters.duplicatesDropped += 1;
    return;
  }
  counters.received += 1;
  counters.lastEventAt = new Date().toISOString();
  const publishedAt = Date.parse(envelope.publishedAt);
  if (Number.isFinite(publishedAt)) {
    counters.lastLatencyMs = Math.max(0, Date.now() - publishedAt);
  }
  emitter.emit('event', envelope);
}

/** Regista um consumidor local (o servidor reencaminha para as ligações SSE). */
export function onRealtimeEvent(handler: RealtimeHandler): () => void {
  emitter.on('event', handler);
  return () => emitter.off('event', handler);
}

/**
 * Publica um evento para todas as instâncias.
 *
 * A entrega local é imediata e não depende do canal partilhado; o `NOTIFY`
 * propaga-o às restantes instâncias. Uma falha de publicação não perde dados:
 * a interação já está gravada e o cliente volta a sincronizar na reconexão.
 */
export async function publishRealtime(
  type: string,
  payload: Record<string, unknown>,
): Promise<RealtimeEnvelope> {
  const envelope: RealtimeEnvelope = {
    id: randomUUID(),
    type,
    payload,
    publishedAt: new Date().toISOString(),
    origin: instanceId,
  };

  dispatch(envelope);

  if (!databasePool) return envelope;

  try {
    await databasePool.query('SELECT pg_notify($1, $2)', [REALTIME_CHANNEL, JSON.stringify(envelope)]);
    counters.published += 1;
  } catch (error) {
    counters.publishErrors += 1;
    console.error(
      '[Guigui.com] Publicação no canal de tempo real falhou (a interação já está gravada):',
      error instanceof Error ? error.message : error,
    );
  }
  return envelope;
}

let listening = false;
let stopping = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = RECONNECT_BASE_MS;
let listeningClient: PoolClient | null = null;

function releaseListeningClient(): void {
  if (!listeningClient) return;
  const client = listeningClient;
  listeningClient = null;
  try {
    client.removeAllListeners('notification');
    client.removeAllListeners('error');
    client.release();
  } catch {
    /* ligação já fechada */
  }
}

function scheduleReconnect(): void {
  counters.connected = false;
  releaseListeningClient();
  if (stopping || !databasePool) return;
  if (reconnectTimer) return;
  const delay = reconnectDelay + Math.floor(Math.random() * 250);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectDelay = Math.min(RECONNECT_MAX_MS, reconnectDelay * 2);
    void connectListener();
  }, delay);
  if (typeof reconnectTimer.unref === 'function') reconnectTimer.unref();
}

async function connectListener(): Promise<void> {
  if (!databasePool || stopping) return;
  try {
    const client = await databasePool.connect();
    client.on('notification', (message) => {
      if (message.channel !== REALTIME_CHANNEL || !message.payload) return;
      try {
        const envelope = JSON.parse(message.payload) as RealtimeEnvelope;
        if (envelope && envelope.type) dispatch(envelope);
      } catch {
        /* payload inválido: ignora sem derrubar a ligação */
      }
    });
    client.on('error', (error) => {
      counters.listenErrors += 1;
      console.error('[Guigui.com] Canal de tempo real perdeu a ligação:', error.message);
      scheduleReconnect();
    });
    await client.query(`LISTEN ${REALTIME_CHANNEL}`);
    listeningClient = client;
    counters.connected = true;
    counters.reconnects += 1;
    reconnectDelay = RECONNECT_BASE_MS;
    if (!listening) {
      listening = true;
      console.log(`[Guigui.com] Canal de tempo real activo em ${REALTIME_CHANNEL} (instância ${instanceId}).`);
    }
  } catch (error) {
    counters.listenErrors += 1;
    console.error(
      '[Guigui.com] Não foi possível subscrever o canal de tempo real:',
      error instanceof Error ? error.message : error,
    );
    scheduleReconnect();
  }
}

/** Arranca a subscrição partilhada. Idempotente. */
export async function startRealtimeListener(): Promise<void> {
  stopping = false;
  await connectListener();
}

/** Encerra a subscrição (usado no desligar do processo). */
export function stopRealtimeListener(): void {
  stopping = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  releaseListeningClient();
  counters.connected = false;
}

/** Diagnóstico para monitorização (sem dados privados). */
export function realtimeStatus(): Record<string, unknown> {
  return {
    channel: REALTIME_CHANNEL,
    instanceId,
    ...counters,
  };
}
