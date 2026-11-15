#!/usr/bin/env tsx
/**
 * Auditoria ponta a ponta do sistema centralizado de moderação.
 *
 * Usa a API HTTP real e as contas demo, cobrindo:
 * evento aprovado, recusa com motivo, pedido de alterações + reenvio,
 * outro módulo (promoção), persistência após novo login e bloqueio de
 * decisão por conta sem permissões.
 *
 * Requer o servidor em execução (npm run dev) e a base PostgreSQL ligada.
 */
import 'dotenv/config';
import { Pool } from 'pg';

const BASE = (process.env.MODERATION_TEST_BASE || 'http://127.0.0.1:3000').replace(/\/$/, '');
const BUSINESS_EMAIL = 'empresa.teste@guigui.com';
const BUSINESS_PASSWORD = 'Guigui@2026!';
const ADMIN_EMAIL = 'admin.teste@guigui.com';
const ADMIN_PASSWORD = 'Guigui@2026!';
const TAG = `MODTEST-${Date.now()}`;

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

interface ApiResult {
  status: number;
  data: any;
}

async function login(email: string, password: string): Promise<string> {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Login ${email} falhou (${response.status}): ${data?.error || 'sem detalhe'}`);
  const setCookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  const raw = setCookies[0] || response.headers.get('set-cookie') || '';
  const cookie = raw.split(';')[0];
  if (!cookie) throw new Error(`Login ${email} não devolveu cookie de sessão.`);
  return cookie;
}

async function api(path: string, cookie: string, init: RequestInit = {}): Promise<ApiResult> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      cookie,
      ...(init.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function createEvent(cookie: string, eventId: string, title: string): Promise<ApiResult> {
  return api('/api/events', cookie, {
    method: 'POST',
    body: JSON.stringify({
      id: eventId,
      title,
      date: '2027-05-20',
      time: '19:00',
      location: 'Bissau, Praça dos Heróis',
      description: 'Evento de auditoria do sistema de moderação.',
      status: 'published',
      ticketTypes: [],
    }),
  });
}

async function findSubmission(adminCookie: string, search: string): Promise<any | null> {
  const list = await api(`/api/moderation/submissions?search=${encodeURIComponent(search)}&limit=50`, adminCookie);
  const items = Array.isArray(list.data?.items) ? list.data.items : [];
  return items.find((item: any) => String(item.title).includes(search)) ?? null;
}

async function main(): Promise<void> {
  console.log(`Auditoria de moderação central — ${TAG}`);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const createdSubmissionIds: string[] = [];
  const createdEventIds: string[] = []; 
  const businessCookie = await login(BUSINESS_EMAIL, BUSINESS_PASSWORD);
  const adminCookie = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

  try {
    // Teste 1 — evento submetido, aparece na fila e é aprovado/publicado.
    console.log('\nTeste 1 — evento aprovado');
    const eventId = `EVT-${TAG}-1`;
    createdEventIds.push(eventId);
    const created = await createEvent(businessCookie, eventId, `Evento ${TAG} aprovação`);
    check(created.status === 200, 'empresa cria evento (200)', created);
    check(created.data?.event?.status === 'pending', 'evento novo fica pendente, não publicado', created.data?.event?.status);

    const submission = await findSubmission(adminCookie, TAG);
    check(Boolean(submission), 'submissão aparece na fila do admin', submission);
    check(submission?.status === 'pending', 'submissão começa pendente', submission?.status);
    check(submission?.companyId, 'submissão ligada à empresa', submission?.companyId);
    if (submission) createdSubmissionIds.push(submission.id);

    const forbidden = submission
      ? await api(`/api/moderation/submissions/${submission.id}/decision`, businessCookie, {
          method: 'POST',
          body: JSON.stringify({ action: 'approve' }),
        })
      : { status: 0, data: {} };
    check(forbidden.status === 403, 'empresa não pode aprovar a própria submissão (403)', forbidden);

    if (submission) {
      const reviewing = await api(`/api/moderation/submissions/${submission.id}/decision`, adminCookie, {
        method: 'POST',
        body: JSON.stringify({ action: 'in_review' }),
      });
      check(reviewing.status === 200 && reviewing.data?.submission?.status === 'in_review', 'admin inicia análise', reviewing);

      const approved = await api(`/api/moderation/submissions/${submission.id}/decision`, adminCookie, {
        method: 'POST',
        body: JSON.stringify({ action: 'approve', reason: 'Evento validado: local e datas confirmados.' }),
      });
      check(approved.status === 200 && approved.data?.submission?.status === 'approved', 'admin aprova evento', approved);
      check(approved.data?.submission?.reviewerName === `admin:${approved.data?.submission?.reviewerId}`, 'revisor registado na decisão', approved.data?.submission?.reviewerName);
    }

    const publicEvents = await api('/api/events', businessCookie);
    const publishedEvent = (publicEvents.data?.events || []).find((event: any) => event.id === eventId);
    check(publishedEvent?.status === 'published', 'evento aprovado fica publicado na base de dados', publishedEvent?.status);

    const businessNotifications = await api('/api/notifications', businessCookie);
    const notificationsText = JSON.stringify(businessNotifications.data);
    check(notificationsText.includes(submission?.id || '___'), 'notificação persistida para a empresa', businessNotifications.status);

    // Teste 2 — recusa com justificação e motivo consultável.
    console.log('\nTeste 2 — recusa com motivo');
    const rejectedEventId = `EVT-${TAG}-2`;
    createdEventIds.push(rejectedEventId);
    await createEvent(businessCookie, rejectedEventId, `Evento ${TAG} recusa`);
    const toReject = await findSubmission(adminCookie, `${TAG} recusa`);
    check(Boolean(toReject), 'segunda submissão na fila', toReject);
    if (toReject) createdSubmissionIds.push(toReject.id);

    const rejectWithoutReason = toReject
      ? await api(`/api/moderation/submissions/${toReject.id}/decision`, adminCookie, {
          method: 'POST',
          body: JSON.stringify({ action: 'reject', reason: '' }),
        })
      : { status: 0, data: {} };
    check(rejectWithoutReason.status === 422, 'recusa sem justificação é bloqueada (422)', rejectWithoutReason);

    const rejectionReason = 'Cartaz sem local verificável e datas incoerentes.';
    const rejected = toReject
      ? await api(`/api/moderation/submissions/${toReject.id}/decision`, adminCookie, {
          method: 'POST',
          body: JSON.stringify({ action: 'reject', reason: rejectionReason }),
        })
      : { status: 0, data: {} };
    check(rejected.status === 200 && rejected.data?.submission?.status === 'rejected', 'admin recusa com justificação', rejected);

    const mineAfterReject = await api('/api/moderation/submissions/mine', businessCookie);
    const ownRejected = (mineAfterReject.data?.items || []).find((item: any) => item.id === toReject?.id);
    check(ownRejected?.status === 'rejected', 'empresa vê a recusa na sua área', ownRejected?.status);
    check(ownRejected?.decisionReason === rejectionReason, 'empresa consulta o motivo da recusa', ownRejected?.decisionReason);

    // Teste 3 — pedido de alterações, correção e reenvio.
    console.log('\nTeste 3 — alterações e reenvio');
    const changesEventId = `EVT-${TAG}-3`;
    createdEventIds.push(changesEventId);
    await createEvent(businessCookie, changesEventId, `Evento ${TAG} correções`);
    const toChange = await findSubmission(adminCookie, `${TAG} correções`);
    check(Boolean(toChange), 'terceira submissão na fila', toChange);
    if (toChange) createdSubmissionIds.push(toChange.id);

    const requested = toChange
      ? await api(`/api/moderation/submissions/${toChange.id}/decision`, adminCookie, {
          method: 'POST',
          body: JSON.stringify({ action: 'request_changes', reason: 'Indique o local exato e corrija o horário.' }),
        })
      : { status: 0, data: {} };
    check(requested.status === 200 && requested.data?.submission?.status === 'changes_requested', 'admin pede alterações', requested);

    const resubmitted = toChange
      ? await api(`/api/moderation/submissions/${toChange.id}/resubmit`, businessCookie, {
          method: 'POST',
          body: JSON.stringify({ changesNote: 'Local corrigido para Bissau, Praça dos Heróis, e horário atualizado.' }),
        })
      : { status: 0, data: {} };
    check(resubmitted.status === 200 && resubmitted.data?.submission?.status === 'resubmitted', 'empresa reenvia após correção', resubmitted);
    check(resubmitted.data?.submission?.version === 2, 'versão incrementada no reenvio', resubmitted.data?.submission?.version);

    const backInQueue = await findSubmission(adminCookie, `${TAG} correções`);
    check(backInQueue?.status === 'resubmitted', 'reenvio volta à fila de moderação', backInQueue?.status);

    // Teste 4 — outro módulo (promoção) na mesma fila central.
    console.log('\nTeste 4 — outro módulo');
    const promotionReference = `promo:${TAG}`;
    const promotion = await api('/api/moderation/submissions', businessCookie, {
      method: 'POST',
      body: JSON.stringify({
        type: 'promotion',
        title: `Promoção ${TAG}`,
        summary: 'Promoção comercial submetida para aprovação.',
        referenceId: promotionReference,
        payload: { discount: 20 },
      }),
    });
    check(promotion.status === 201 && promotion.data?.submission?.status === 'pending', 'promoção entra na fila central', promotion);
    const promotionSubmission = promotion.data?.submission;
    if (promotionSubmission) createdSubmissionIds.push(promotionSubmission.id);

    const promotionApproved = promotionSubmission
      ? await api(`/api/moderation/submissions/${promotionSubmission.id}/decision`, adminCookie, {
          method: 'POST',
          body: JSON.stringify({ action: 'approve', reason: 'Promoção conforme as regras comerciais.' }),
        })
      : { status: 0, data: {} };
    check(promotionApproved.status === 200 && promotionApproved.data?.submission?.status === 'approved', 'promoção aprovada na mesma fila', promotionApproved);

    const campaignId = `CMP-${TAG}`;
    const campaign = await api('/api/marketing/campaigns', businessCookie, {
      method: 'POST',
      body: JSON.stringify({
        id: campaignId,
        businessId: submission?.companyId,
        name: `Campanha ${TAG}`,
        status: 'scheduled',
        startsAt: '2027-06-01T10:00:00.000Z',
        endsAt: '2027-06-30T10:00:00.000Z',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    });
    check(campaign.status === 201, 'empresa cria campanha agendada', campaign);
    const campaignSubmission = await findSubmission(adminCookie, `Campanha ${TAG}`);
    check(campaignSubmission?.type === 'campaign' && campaignSubmission?.status === 'pending', 'campanha entra na fila central', campaignSubmission);
    if (campaignSubmission) createdSubmissionIds.push(campaignSubmission.id);

    const campaignApproved = campaignSubmission
      ? await api(`/api/moderation/submissions/${campaignSubmission.id}/decision`, adminCookie, {
          method: 'POST',
          body: JSON.stringify({ action: 'approve', reason: 'Campanha conforme as regras de publicidade.' }),
        })
      : { status: 0, data: {} };
    check(campaignApproved.status === 200 && campaignApproved.data?.submission?.status === 'approved', 'campanha aprovada na mesma fila', campaignApproved);

    const scheduledCampaign = await pool.query('SELECT moderation_status FROM marketing_scheduled_items WHERE item_id=$1', [campaignId]);
    check(scheduledCampaign.rows[0]?.moderation_status === 'approved', 'agendamento só é desbloqueado após aprovação', scheduledCampaign.rows[0]);
    await pool.query('DELETE FROM marketing_scheduled_items WHERE item_id=$1', [campaignId]);
    await pool.query('DELETE FROM marketing_campaigns WHERE id=$1', [campaignId]);

    // Teste 5 — persistência após nova autenticação.
    console.log('\nTeste 5 — persistência');
    const freshAdmin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const freshBusiness = await login(BUSINESS_EMAIL, BUSINESS_PASSWORD);
    const persisted = submission ? await api(`/api/moderation/submissions/${submission.id}`, freshAdmin) : { status: 0, data: {} };
    check(persisted.status === 200 && persisted.data?.submission?.status === 'approved', 'decisão persiste após novo login admin', persisted.data?.submission?.status);
    check(
      Array.isArray(persisted.data?.submission?.history) && persisted.data.submission.history.length >= 3,
      'histórico de decisões persiste na base de dados',
      persisted.data?.submission?.history?.length,
    );

    const persistedOwn = await api('/api/moderation/submissions/mine', freshBusiness);
    check(
      (persistedOwn.data?.items || []).some((item: any) => item.id === submission?.id && item.status === 'approved'),
      'empresa continua a ver a submissão aprovada após relogin',
    );

    // Teste 6 — isolamento: utilizador comum não acede à fila administrativa.
    console.log('\nTeste 6 — segurança');
    const queueAsBusiness = await api('/api/moderation/submissions', businessCookie);
    check(queueAsBusiness.status === 403, 'empresa não acede à fila global do admin (403)', queueAsBusiness);

    console.log(`\nResultado: ${passed} aprovados, ${failed} falhados.`);
  } finally {
    try {
      if (createdSubmissionIds.length > 0) {
        await pool.query(`DELETE FROM notifications WHERE metadata->>'submissionId' = ANY($1::text[])`, [createdSubmissionIds]);
        await pool.query(`DELETE FROM audit_logs WHERE resource='moderation_submission' AND resource_id = ANY($1::text[])`, [createdSubmissionIds]);
        await pool.query('DELETE FROM moderation_submissions WHERE id = ANY($1::text[])', [createdSubmissionIds]);
      }
      if (createdEventIds.length > 0) {
        await pool.query('DELETE FROM events WHERE id = ANY($1::text[])', [createdEventIds]);
      }
      console.log('Dados de teste removidos da base de dados.');
    } catch (cleanupError) {
      console.error('Falha ao limpar dados de teste:', cleanupError);
    }
    await pool.end();
  }

  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error('Auditoria interrompida:', error instanceof Error ? error.message : error);
  process.exit(1);
});
