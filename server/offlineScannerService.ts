import { createHmac } from 'node:crypto';
import { databasePool } from './db';

/**
 * Modo offline do scanner de portaria (Secção 7.2 / GUI-3.5.09 e 3.5.10).
 *
 * Um scanner não pode validar bilhetes offline sem saber quais são válidos.
 * Por isso, antes de ficar sem rede, a equipa descarrega um **manifesto
 * assinado** com os bilhetes válidos do evento. Offline, a validação verifica
 * o código contra esse manifesto e regista a passagem localmente. Ao recuperar
 * a rede, o lote é sincronizado e o servidor passa a ser a autoridade: pode
 * detectar que o mesmo bilhete foi aceite noutro terminal durante o período
 * offline, que é o risco de duplicação que o escopo exige sinalizar.
 *
 * O manifesto é deliberadamente escasso: só o código e o token, nunca dados
 * pessoais do titular.
 */

export type OfflineManifestEntry = { code: string; token: string };

export type OfflineManifest = {
  eventId: string;
  companyId: string;
  generatedAt: string;
  expiresAt: string;
  signature: string;
  tickets: OfflineManifestEntry[];
};

const MANIFEST_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas

const manifestSignature = (payload: { eventId: string; companyId: string; expiresAt: string; tickets: OfflineManifestEntry[] }, secret: string) =>
  createHmac('sha256', secret)
    .update(`${payload.eventId}|${payload.companyId}|${payload.expiresAt}|${payload.tickets.map((t) => t.token).join(',')}`)
    .digest('hex');

/**
 * Lista os bilhetes ainda utilizáveis do evento. Um bilhete `used`, `cancelled`
 * ou expirado nunca entra no manifesto.
 */
export async function buildOfflineManifest(eventId: string, companyId: string, secret: string): Promise<OfflineManifest> {
  if (!databasePool) throw new Error('O manifesto offline exige base de dados configurada.');
  const result = await databasePool.query(
    `SELECT t.ticket_code, t.qr_token
     FROM tickets t
     WHERE t.event_id=$1 AND t.status='valid' AND (t.expires_at IS NULL OR t.expires_at > NOW())
     ORDER BY t.created_at ASC
     LIMIT 20000`,
    [eventId],
  );
  const tickets: OfflineManifestEntry[] = result.rows.map((row) => ({ code: row.ticket_code, token: row.qr_token }));
  const generatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + MANIFEST_TTL_MS).toISOString();
  return {
    eventId,
    companyId,
    generatedAt,
    expiresAt,
    signature: manifestSignature({ eventId, companyId, expiresAt, tickets }, secret),
    tickets,
  };
}

export function verifyOfflineManifest(manifest: OfflineManifest, secret: string): boolean {
  if (!manifest?.signature || !manifest.eventId) return false;
  if (Date.parse(manifest.expiresAt) <= Date.now()) return false;
  const expected = manifestSignature(
    { eventId: manifest.eventId, companyId: manifest.companyId, expiresAt: manifest.expiresAt, tickets: manifest.tickets || [] },
    secret,
  );
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(manifest.signature, 'utf8');
  return a.length === b.length && timingSafeEqualBuffers(a, b);
}

function timingSafeEqualBuffers(a: Buffer, b: Buffer): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export type OfflineValidationRecord = { code: string; validatedAt: string; deviceId: string };

export type BatchOutcome = {
  code: string;
  result: 'accepted' | 'already_used' | 'cancelled' | 'not_found' | 'expired';
  message: string;
};

/**
 * Sincroniza as validações feitas offline. O servidor decide: um bilhete que
 * entretanto foi cancelado ou usado noutro terminal é recusado aqui, e o
 * scanner tem de corrigir a entrada que concessionou.
 */
export async function syncOfflineValidations(
  records: OfflineValidationRecord[],
): Promise<BatchOutcome[]> {
  if (!databasePool) throw new Error('A sincronização exige base de dados configurada.');
  const outcomes: BatchOutcome[] = [];

  for (const record of records) {
    const result = await databasePool.query(
      `SELECT t.id, t.status, t.expires_at
       FROM tickets t
       WHERE t.ticket_code=$1 OR t.qr_token=$1
       LIMIT 1`,
      [record.code],
    );
    const row = result.rows[0];
    if (!row) {
      outcomes.push({ code: record.code, result: 'not_found', message: 'Bilhete desconhecido.' });
      continue;
    }
    if (row.status === 'used') {
      outcomes.push({ code: record.code, result: 'already_used', message: 'Bilhete já utilizado — confirmado na sincronização.' });
      continue;
    }
    if (row.status === 'cancelled') {
      outcomes.push({ code: record.code, result: 'cancelled', message: 'Bilhete cancelado depois da validação offline.' });
      continue;
    }
    if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
      outcomes.push({ code: record.code, result: 'expired', message: 'Bilhete expirado.' });
      continue;
    }

    // Só marca como usado a partir de `valid`, mantendo a protecção contra reutilização.
    const updated = await databasePool.query(
      `UPDATE tickets SET status='used' WHERE id=$1 AND status='valid' RETURNING id`,
      [row.id],
    );
    if (updated.rowCount !== 1) {
      outcomes.push({ code: record.code, result: 'already_used', message: 'Bilhete já utilizado noutro terminal.' });
      continue;
    }
    await databasePool.query(
      `INSERT INTO ticket_validations (id, ticket_id, result, created_at) VALUES ($1,$2,'accepted',NOW())`,
      [`offline-validation-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, row.id],
    );
    outcomes.push({ code: record.code, result: 'accepted', message: 'Entrada confirmada na sincronização.' });
  }

  return outcomes;
}
