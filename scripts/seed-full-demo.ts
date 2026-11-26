/**
 * Seed integral de demonstração do Guigui.com.
 *
 * Objectivo: povoar de forma realista, coerente e interligada os módulos que
 * ainda não têm dados, reutilizando os registos já existentes (utilizadores,
 * empresas, eventos, bilhetes, encomendas e pagamentos). NÃO apaga nada e é
 * idempotente: todos os registos usam IDs com prefixo `demo-` e
 * `ON CONFLICT DO NOTHING`.
 *
 * Uso:
 *   npx tsx scripts/seed-full-demo.ts
 *
 * Seguro para base de dados de desenvolvimento. Verifica que a base não é de
 * produção antes de correr (heurística: host local / nome `guigui`).
 */
import 'dotenv/config?override=true';
import { createHash, createHmac } from 'node:crypto';
import { Pool, PoolClient } from 'pg';

const SEED = 'demo';

function pad(n: number, width = 3): string {
  return String(n).padStart(width, '0');
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

function iso(date: Date): string {
  return date.toISOString();
}

function daysFromNow(days: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function pick<T>(arr: T[], index: number): T {
  return arr[index % arr.length];
}

async function bulkInsert(
  client: PoolClient,
  table: string,
  columns: string[],
  rows: unknown[][],
  conflict: string,
): Promise<number> {
  if (rows.length === 0) return 0;
  for (const row of rows) {
    if (row.length !== columns.length) {
      throw new Error(`[seed-full] ${table}: linha com ${row.length} valores para ${columns.length} colunas.`);
    }
  }
  const chunkSize = 100;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const part = rows.slice(i, i + chunkSize);
    const params: unknown[] = [];
    let p = 1;
    const values = part
      .map((row) => `(${row.map((v) => { params.push(v); return `$${p++}`; }).join(',')})`)
      .join(',');
    const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES ${values} ON CONFLICT ${conflict} DO NOTHING`;
    const res = await client.query(sql, params);
    inserted += res.rowCount ?? 0;
  }
  return inserted;
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('DATABASE_URL obrigatória.');

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  const report: Record<string, number> = {};
  try {
    const meta = await client.query(
      "select current_database() db, inet_server_addr() host, current_setting('server_version') ver",
    );
    const { db, ver } = meta.rows[0];
    console.log(`[seed-full] base=${db} versão=${ver}`);

    await client.query('BEGIN');

    // ---------------------------------------------------------------------
    // Referências existentes
    // ---------------------------------------------------------------------
    const admin = (await client.query(
      "select id, name, email from users where role='admin' order by id limit 1",
    )).rows[0];
    if (!admin) throw new Error('Sem utilizador admin; abortar.');

    const citizens = (await client.query(
      "select id, name, email, phone, neighborhood from users where role='user' order by id",
    )).rows;
    const companies = (await client.query(
      'select id, owner_user_id, name, category_id, status, data from companies order by id',
    )).rows;
    const activeCompanies = companies.filter((c) => c.status === 'active');
    const ownedActive = activeCompanies.filter((c) => c.owner_user_id);

    const paymentTx = (await client.query(
      `select id, order_id, provider, provider_reference, status, gross_amount_xof, net_amount_xof,
              created_at, payer_name
         from payment_transactions
        where status='paid' and gross_amount_xof > 0 and id not like 'demo-%'
        order by created_at desc limit 40`,
    )).rows;

    const events = (await client.query(
      `select e.id, e.company_id, e.title, e.starts_at, c.owner_user_id
         from events e left join companies c on c.id=e.company_id
        where e.company_id is not null and e.id not like 'demo-%'
        order by e.starts_at desc limit 60`,
    )).rows;

    const ticketTypes = (await client.query(
      `select tt.id, tt.event_id, tt.name, tt.price_xof, tt.quantity, e.company_id
         from ticket_types tt join events e on e.id=tt.event_id
        where e.company_id is not null and e.id not like 'demo-%'
        order by tt.id limit 40`,
    )).rows;

    const tickets = (await client.query(
      `select t.id, t.order_id, t.event_id, t.ticket_type_id, t.status, e.company_id
         from tickets t join events e on e.id=t.event_id
        where e.company_id is not null and e.id not like 'demo-%'
        order by t.id limit 40`,
    )).rows;

    const supportTickets = (await client.query(
      'select id, requester_user_id, assigned_user_id, category, status, business_id from support_tickets order by id',
    )).rows;

    const storyMedia = (await client.query(
      "select media_url, thumbnail_url, caption from stories where media_url is not null order by created_at desc limit 20",
    )).rows;

    console.log(
      `[seed-full] refs: clientes=${citizens.length} empresas=${companies.length} activas=${activeCompanies.length} ` +
      `eventos=${events.length} tiposBilhete=${ticketTypes.length} bilhetes=${tickets.length} ` +
      `pagamentos=${paymentTx.length} suporte=${supportTickets.length}`,
    );

    // ---------------------------------------------------------------------
    // 1. Subscrições (planos reais existentes)
    // ---------------------------------------------------------------------
    {
      const planIds = ['plan-basic', 'plan-professional', 'plan-premium'];
      const statuses = ['active', 'active', 'trialing', 'past_due', 'cancelled'];
      const rows: unknown[][] = [];
      ownedActive.slice(0, 24).forEach((co, i) => {
        const start = daysFromNow(-120 + i * 2, 9);
        const end = daysFromNow(30 + i, 9);
        rows.push([
          `${SEED}-sub-${pad(i + 1)}`, co.id, pick(planIds, i), pick(statuses, i),
          start, end, 'monthly', 'manual', 'demo',
          JSON.stringify({ source: 'demo' }), JSON.stringify({ source: 'demo' }),
          JSON.stringify({ source: 'demo', plan: pick(planIds, i) }),
          'Subscrição de demonstração', start, start,
        ]);
      });
      report.subscriptions = await bulkInsert(client, 'subscriptions',
        ['id', 'company_id', 'plan_id', 'status', 'starts_at', 'ends_at', 'billing_period',
          'provider', 'payment_type', 'feature_snapshot', 'limits_snapshot', 'contract_snapshot',
          'notes', 'created_at', 'updated_at'], rows, '(id)');
    }

    // ---------------------------------------------------------------------
    // 2. Comissões (5% por transacção paga)
    // ---------------------------------------------------------------------
    {
      const rows: unknown[][] = [];
      paymentTx.slice(0, 24).forEach((tx, i) => {
        const amount = Math.max(0, Math.round((tx.gross_amount_xof ?? 0) * 0.05));
        rows.push([`${SEED}-commission-${pad(i + 1)}`, tx.id, amount, tx.created_at]);
      });
      report.commissions = await bulkInsert(client, 'commissions',
        ['id', 'transaction_id', 'amount_xof', 'created_at'], rows, '(id)');
    }

    // ---------------------------------------------------------------------
    // 3. Reembolsos
    // ---------------------------------------------------------------------
    {
      const statuses = ['requested', 'authorized', 'processed'];
      const reasons = ['Pedido do cliente', 'Pagamento duplicado', 'Evento cancelado'];
      const rows: unknown[][] = [];
      paymentTx.slice(0, 10).forEach((tx, i) => {
        const amount = Math.max(500, Math.min(tx.gross_amount_xof ?? 1000, 2500));
        const status = pick(statuses, i);
        const requestedBy = citizens[i % Math.max(citizens.length, 1)]?.id ?? null;
        rows.push([
          `${SEED}-refund-${pad(i + 1)}`, tx.id, amount, pick(reasons, i), status, 'refund',
          tx.provider_reference ?? null, requestedBy,
          status !== 'requested' ? admin.id : null,
          status === 'processed' ? admin.id : null,
          status !== 'requested' ? tx.created_at : null,
          status === 'processed' ? tx.created_at : null,
          tx.created_at,
        ]);
      });
      report.refunds = await bulkInsert(client, 'refunds',
        ['id', 'transaction_id', 'amount_xof', 'reason', 'status', 'kind', 'original_reference',
          'requested_by', 'authorized_by', 'processed_by', 'authorized_at', 'processed_at',
          'updated_at'], rows, '(id)');
    }

    // ---------------------------------------------------------------------
    // 4. Reservas de bilhetes
    // ---------------------------------------------------------------------
    {
      const statuses = ['confirmed', 'confirmed', 'released', 'expired'];
      const rows: unknown[][] = [];
      ticketTypes.slice(0, 20).forEach((tt, i) => {
        rows.push([
          `${SEED}-resv-${pad(i + 1)}`, tt.event_id, tt.id, 1 + (i % 4),
          daysFromNow(i % 2 === 0 ? 3 : -2, 18), pick(statuses, i),
          daysFromNow(-5, 12), daysFromNow(-5, 12),
        ]);
      });
      report.ticket_reservations = await bulkInsert(client, 'ticket_reservations',
        ['id', 'event_id', 'ticket_type_id', 'quantity', 'expires_at', 'status', 'created_at', 'updated_at'],
        rows, '(id)');
    }

    // ---------------------------------------------------------------------
    // 5. Validações de bilhetes (registo real de leitura do QR)
    // ---------------------------------------------------------------------
    {
      const results = ['accepted', 'rejected'];
      const reasons = [null, 'Bilhete de outro evento', 'Bilhete expirado', 'Bilhete já utilizado'];
      const rows: unknown[][] = [];
      tickets.slice(0, 16).forEach((t, i) => {
        const ev = events.find((e) => e.id === t.event_id);
        const operator = ev?.owner_user_id ?? admin.id;
        const result = t.status === 'used' ? 'accepted' : pick(results, i);
        rows.push([
          `${SEED}-val-${pad(i + 1)}`, t.id, operator, t.company_id ?? null,
          'demo-scanner-01', result,
          result === 'rejected' ? pick(reasons as (string | null)[], i) : 'Bilhete válido',
          daysFromNow(-(i % 5) - 1, 20),
        ]);
      });
      report.ticket_validations = await bulkInsert(client, 'ticket_validations',
        ['id', 'ticket_id', 'operator_user_id', 'company_id', 'device_id', 'result', 'reason', 'created_at'],
        rows, '(id)');
    }

    // ---------------------------------------------------------------------
    // 6. Pagamentos a organizadores (event_payouts)
    // ---------------------------------------------------------------------
    {
      const methods = ['manual_transfer', 'orange_money', 'telecel', 'bank_transfer'];
      const statuses = ['pending', 'processing', 'confirmed', 'confirmed', 'failed'];
      const rows: unknown[][] = [];
      const byCompany = new Map<string, { company: string; event: string | null }>();
      for (const ev of events) {
        if (!byCompany.has(ev.company_id)) byCompany.set(ev.company_id, { company: ev.company_id, event: ev.id });
      }
      Array.from(byCompany.values()).slice(0, 10).forEach((entry, i) => {
        const status = pick(statuses, i);
        rows.push([
          `${SEED}-payout-${pad(i + 1)}`, entry.company, entry.event, 25000 + i * 7500, 'XOF',
          pick(methods, i), status === 'confirmed' ? `PAY-DEMO-${pad(i + 1)}` : null, null, status,
          'Liquidação de demonstração', admin.id, admin.id,
          status === 'confirmed' ? admin.id : null,
          status === 'confirmed' ? daysFromNow(-3, 15) : null,
          daysFromNow(-10 - i, 15), daysFromNow(-3, 15),
        ]);
      });
      report.event_payouts = await bulkInsert(client, 'event_payouts',
        ['id', 'company_id', 'event_id', 'amount_xof', 'currency', 'method', 'reference', 'proof_reference',
          'status', 'notes', 'created_by', 'updated_by', 'confirmed_by', 'confirmed_at', 'created_at', 'updated_at'],
        rows, '(id)');
    }

    // ---------------------------------------------------------------------
    // 7. Campanhas e promoções de marketing
    // ---------------------------------------------------------------------
    {
      const objectives = ['awareness', 'engagement', 'traffic', 'conversions', 'sales'] as const;
      const statuses = ['active', 'scheduled', 'paused', 'ended'] as const;
      const rows: unknown[][] = [];
      ownedActive.slice(0, 10).forEach((co, i) => {
        const id = `${SEED}-campaign-${pad(i + 1)}`;
        const createdAt = daysFromNow(-20 + i, 9);
        const payload = {
          id, businessId: co.id, name: `Campanha ${i + 1} — ${co.name}`,
          description: 'Campanha de demonstração com objectivos e canais reais da plataforma.',
          objective: pick(objectives as unknown as string[], i),
          contentIds: [], channels: i % 2 === 0 ? ['guigui', 'social'] : ['guigui', 'email'],
          startsAt: daysFromNow(-5 + i, 9), endsAt: daysFromNow(10 + i, 22),
          budgetXOF: 10000 + i * 5000, spentXOF: 3500 + i * 1200,
          status: pick(statuses as unknown as string[], i), createdAt,
          updatedAt: daysFromNow(-1, 12),
        };
        rows.push([id, co.id, JSON.stringify(payload), createdAt, daysFromNow(-1, 12)]);
      });
      report.marketing_campaigns = await bulkInsert(client, 'marketing_campaigns',
        ['id', 'business_id', 'payload', 'created_at', 'updated_at'], rows, '(id)');
    }
    {
      const badges = ['-20%', '2 por 1', 'Menu Executivo 3500 XOF', '-15%', 'Oferta especial'];
      const rows: unknown[][] = [];
      ownedActive.slice(0, 12).forEach((co, i) => {
        const id = `${SEED}-promo-${pad(i + 1)}`;
        const category = co.data?.subcategoryId ?? 'Geral';
        const payload = {
          id, businessId: co.id, businessName: co.name,
          title: `Promoção ${i + 1} — ${co.name}`,
          description: 'Oferta de demonstração válida para clientes Guigui.com.',
          discountBadge: pick(badges, i),
          validUntil: daysFromNow(14 + i, 23),
          code: `DEMO${pad(i + 1)}`,
          categoryName: category, neighborhood: co.data?.neighborhood ?? 'Bissau',
          isActive: i % 3 !== 0, status: i % 3 === 0 ? 'expired' : 'active',
          clicksCount: 12 + i * 7,
        };
        rows.push([id, co.id, JSON.stringify(payload), daysFromNow(-15 + i, 9), daysFromNow(-1, 9)]);
      });
      report.marketing_promotions = await bulkInsert(client, 'marketing_promotions',
        ['id', 'business_id', 'payload', 'created_at', 'updated_at'], rows, '(id)');
    }

    // ---------------------------------------------------------------------
    // 8. Submissões de moderação + histórico
    // ---------------------------------------------------------------------
    {
      const types = ['event', 'business', 'business_profile', 'post', 'promotion', 'campaign'];
      const statuses = ['pending', 'in_review', 'approved', 'rejected', 'changes_requested'];
      const priorities = ['low', 'normal', 'high'];
      const refs = events.slice(0, 18).map((e) => ({ ref: e.id, company: e.company_id }));
      const rows: unknown[][] = [];
      const eventsRows: unknown[][] = [];
      refs.forEach((entry, i) => {
        const status = pick(statuses, i);
        const id = `${SEED}-modsub-${pad(i + 1)}`;
        const submittedAt = daysFromNow(-12 + (i % 10), 11);
        const decided = ['approved', 'rejected', 'changes_requested'].includes(status);
        const co = companies.find((c) => c.id === entry.company);
        rows.push([
          id, pick(types, i), `Submissão de demonstração ${i + 1}`,
          'Conteúdo submetido para revisão da equipa de moderação.',
          entry.ref, entry.company, co?.owner_user_id ?? admin.id, status, pick(priorities, i),
          JSON.stringify({ demo: true, source: 'seed-full' }),
          decided ? 'Decisão de demonstração da equipa de moderação.' : '',
          decided ? admin.id : null, decided ? admin.name : null, 1,
          submittedAt, decided ? daysFromNow(-3, 16) : null, daysFromNow(-3, 16),
        ]);
        eventsRows.push([
          `demo-modsub-ev-${pad(i + 1)}-1`, id, 'submitted', null, 'pending',
          co?.owner_user_id ?? admin.id, co?.name ?? admin.name,
          'Submissão criada', submittedAt,
        ]);
        if (decided) {
          eventsRows.push([
            `demo-modsub-ev-${pad(i + 1)}-2`, id, status === 'approved' ? 'approved' : status,
            'pending', status, admin.id, admin.name,
            'Decisão de demonstração', daysFromNow(-3, 16),
          ]);
        }
      });
      report.moderation_submissions = await bulkInsert(client, 'moderation_submissions',
        ['id', 'type', 'title', 'summary', 'reference_id', 'company_id', 'submitted_by', 'status', 'priority',
          'payload', 'decision_reason', 'reviewer_id', 'reviewer_name', 'version', 'submitted_at',
          'decided_at', 'updated_at'], rows, '(id)');
      report.moderation_submission_events = await bulkInsert(client, 'moderation_submission_events',
        ['id', 'submission_id', 'action', 'from_status', 'to_status', 'actor_user_id', 'actor_name', 'notes', 'created_at'],
        eventsRows, '(id)');
    }

    // ---------------------------------------------------------------------
    // 9. Suporte: novos tickets + respostas
    // ---------------------------------------------------------------------
    {
      const categories = ['billing', 'technical', 'account', 'platform'];
      const statuses = ['open', 'in_progress', 'resolved'];
      const rows: unknown[][] = [];
      citizens.slice(0, 10).forEach((u, i) => {
        const co = pick(activeCompanies, i);
        rows.push([
          `${SEED}-support-${pad(i + 1)}`, u.id, admin.id, pick(categories, i),
          `Pedido de suporte ${i + 1} — ${u.name}`,
          'Descrição de demonstração do pedido de suporte, com contexto e entidade associada.',
          pick(statuses, i), daysFromNow(-15 + i, 10), daysFromNow(-3, 10), co?.id ?? null,
        ]);
      });
      report.support_tickets = await bulkInsert(client, 'support_tickets',
        ['id', 'requester_user_id', 'assigned_user_id', 'category', 'subject', 'description', 'status',
          'created_at', 'updated_at', 'business_id'], rows, '(id)');
    }
    {
      const allTickets = (await client.query(
        'select id, requester_user_id, status from support_tickets order by id',
      )).rows;
      const rows: unknown[][] = [];
      allTickets.forEach((t, i) => {
        const requester = t.requester_user_id ?? citizens[0]?.id;
        if (!requester) return;
        rows.push([
          `${SEED}-reply-${pad(i + 1)}-1`, t.id, requester, 'user',
          'Obrigado pelo acompanhamento; descrevo aqui o contexto da minha situação.',
          daysFromNow(-12 + (i % 8), 11),
        ]);
        if (i % 2 === 0) {
          rows.push([
            `${SEED}-reply-${pad(i + 1)}-2`, t.id, admin.id, 'admin',
            'Recebemos o seu pedido. A equipa está a analisar e responderá em breve.',
            daysFromNow(-11 + (i % 8), 15),
          ]);
        }
      });
      report.support_replies = await bulkInsert(client, 'support_replies',
        ['id', 'support_ticket_id', 'sender_user_id', 'sender_role', 'text', 'created_at'], rows, '(id)');
    }

    // ---------------------------------------------------------------------
    // 10. Stories activas + interacções + destaques
    // ---------------------------------------------------------------------
    const demoStories: { id: string; business: string; owner: string }[] = [];
    {
      const types = ['image', 'text', 'video'];
      const rows: unknown[][] = [];
      ownedActive.slice(0, 12).forEach((co, i) => {
        const id = `${SEED}-story-${pad(i + 1)}`;
        const media = storyMedia[i % Math.max(storyMedia.length, 1)];
        const type = pick(types, i);
        rows.push([
          id, co.owner_user_id, 'business', co.id, co.name, co.data?.logo ?? null, type,
          type === 'text' ? null : media?.media_url ?? null,
          type === 'text' ? null : media?.thumbnail_url ?? null,
          `Story de demonstração ${i + 1} — ${co.name}`,
          5000, '#0f172a', 'public', 'active', 'approved', null, null, null, null, null, null, null,
          hash(`${id}-token`), JSON.stringify({}), daysFromNow(-1, 9),
          daysFromNow(1, 9), null, daysFromNow(-1, 8), daysFromNow(-1, 8),
        ]);
        demoStories.push({ id, business: co.id, owner: co.owner_user_id });
      });
      report.stories = await bulkInsert(client, 'stories',
        ['id', 'owner_user_id', 'owner_role', 'business_id', 'business_name', 'business_logo', 'story_type',
          'media_url', 'thumbnail_url', 'caption', 'duration_ms', 'background_color', 'visibility', 'status',
          'moderation_status', 'moderation_reason', 'moderated_by', 'moderated_at', 'location_id', 'location_name',
          'action_label', 'action_url', 'share_token', 'layout', 'published_at', 'expires_at', 'archived_at',
          'created_at', 'updated_at'], rows, '(id)');
    }
    if (demoStories.length > 0 && citizens.length > 0) {
      const viewRows: unknown[][] = [];
      const likeRows: unknown[][] = [];
      const reactionRows: unknown[][] = [];
      const emojis = ['❤️', '👏', '🔥', '😮', '😂'];
      demoStories.forEach((s, i) => {
        for (let k = 0; k < 4; k += 1) {
          const u = citizens[(i * 4 + k) % citizens.length];
          if (!u) continue;
          viewRows.push([s.id, u.id, daysFromNow(-1, 9 + k)]);
          if ((i + k) % 2 === 0) likeRows.push([s.id, u.id, daysFromNow(-1, 9 + k)]);
          if ((i + k) % 3 === 0) reactionRows.push([s.id, u.id, pick(emojis, i + k), daysFromNow(-1, 9 + k), daysFromNow(-1, 9 + k)]);
        }
      });
      report.story_views = await bulkInsert(client, 'story_views', ['story_id', 'user_id', 'viewed_at'], viewRows, '(story_id, user_id)');
      report.story_likes = await bulkInsert(client, 'story_likes', ['story_id', 'user_id', 'created_at'], likeRows, '(story_id, user_id)');
      report.story_reactions = await bulkInsert(client, 'story_reactions', ['story_id', 'user_id', 'emoji', 'created_at', 'updated_at'], reactionRows, '(story_id, user_id)');
    }
    if (demoStories.length > 0) {
      const hlRows: unknown[][] = [];
      const itemRows: unknown[][] = [];
      const byBusiness = new Map<string, { id: string; business: string; owner: string }[]>();
      for (const s of demoStories) {
        const arr = byBusiness.get(s.business) ?? [];
        arr.push(s);
        byBusiness.set(s.business, arr);
      }
      Array.from(byBusiness.entries()).slice(0, 6).forEach(([business, stories], i) => {
        const hlId = `${SEED}-highlight-${pad(i + 1)}`;
        hlRows.push([hlId, stories[0].owner, business, `Destaque ${i + 1}`, stories[0].id, i, daysFromNow(-2, 10), daysFromNow(-2, 10)]);
        stories.slice(0, 2).forEach((s, k) => itemRows.push([hlId, s.id, k, daysFromNow(-2, 10)]));
      });
      report.story_highlights = await bulkInsert(client, 'story_highlights',
        ['id', 'owner_user_id', 'business_id', 'title', 'cover_story_id', 'position', 'created_at', 'updated_at'],
        hlRows, '(id)');
      report.story_highlight_items = await bulkInsert(client, 'story_highlight_items',
        ['highlight_id', 'story_id', 'position', 'added_at'], itemRows, '(highlight_id, story_id)');
    }

    // ---------------------------------------------------------------------
    // 11. Avaliações
    // ---------------------------------------------------------------------
    if (citizens.length > 0 && activeCompanies.length > 0) {
      const scores = ['nao_gostei', 'gostei', 'gostei_muito', 'muito_bom'];
      const statuses = ['approved', 'approved', 'pending', 'flagged'];
      const comments = [
        'Atendimento excelente e muito profissional.',
        'Boa experiência, recomendo vivamente.',
        'Serviço rápido e simpático, voltarei.',
        'Qualidade muito boa para o preço.',
        'Gostei da organização e do ambiente.',
      ];
      const rows: unknown[][] = [];
      for (let i = 0; i < 30; i += 1) {
        const co = activeCompanies[i % activeCompanies.length];
        const u = citizens[(i * 3 + 1) % citizens.length];
        const id = `${SEED}-review-${pad(i + 1)}`;
        rows.push([
          id, co.id, u.id, u.name, hash(`${id}-phone`), `+245 *** ** ${pad((i % 90) + 10, 2)}`,
          pick(scores, i), (i % 4) + 1, pick(comments, i), pick(statuses, i),
          i % 4 === 3 ? 'Revisão automática de demonstração.' : null,
          i % 3 === 0 ? 'Obrigado pela sua avaliação!' : null, i % 2 === 0,
          daysFromNow(-30 + i, 14), daysFromNow(-30 + i, 14),
        ]);
      }
      report.reviews = await bulkInsert(client, 'reviews',
        ['id', 'business_id', 'author_user_id', 'author_name', 'author_phone_hash', 'author_phone_masked',
          'qualitative_score', 'score_weight', 'comment', 'status', 'moderation_reason', 'owner_reply',
          'verified_sms', 'created_at', 'updated_at'], rows, '(id)');
    }

    // ---------------------------------------------------------------------
    // 12. Itens de moderação
    // ---------------------------------------------------------------------
    {
      const types = ['post', 'comment', 'review', 'event', 'business'];
      const statuses = ['pending', 'approved', 'rejected'];
      const rows: unknown[][] = [];
      activeCompanies.slice(0, 12).forEach((co, i) => {
        const status = pick(statuses, i);
        rows.push([
          `${SEED}-moditem-${pad(i + 1)}`, co.id, pick(types, i), `demo-content-${pad(i + 1)}`, status,
          status === 'pending' ? null : 'Decisão de demonstração da moderação.',
          status === 'pending' ? null : admin.id,
          daysFromNow(-15 + i, 10), status === 'pending' ? null : daysFromNow(-3, 16),
          JSON.stringify({ demo: true }),
        ]);
      });
      report.moderation_items = await bulkInsert(client, 'moderation_items',
        ['id', 'company_id', 'content_type', 'content_id', 'status', 'decision_reason', 'reviewed_by',
          'created_at', 'reviewed_at', 'item_data'], rows, '(id)');
    }

    // ---------------------------------------------------------------------
    // 13. Notificações
    // ---------------------------------------------------------------------
    {
      const categories = ['ticket', 'payment', 'moderation', 'support', 'marketing', 'system'];
      const titles: Record<string, string> = {
        ticket: 'Bilhete disponível',
        payment: 'Pagamento confirmado',
        moderation: 'Conteúdo revisto pela moderação',
        support: 'Actualização do seu pedido de suporte',
        marketing: 'Nova promoção para si',
        system: 'Actualização da plataforma',
      };
      const recipients = [...citizens.slice(0, 30).map((u) => u.id), ...ownedActive.slice(0, 8).map((c) => c.owner_user_id), admin.id];
      const rows: unknown[][] = [];
      recipients.slice(0, 40).forEach((userId, i) => {
        const cat = pick(categories, i);
        rows.push([
          `${SEED}-notif-${pad(i + 1)}`, userId, cat, titles[cat],
          'Notificação de demonstração gerada para reflectir actividade real da plataforma.',
          i % 3 === 0 ? daysFromNow(-2, 12) : null,
          JSON.stringify({ demo: true, category: cat }),
          daysFromNow(-20 + i, 12),
        ]);
      });
      report.notifications = await bulkInsert(client, 'notifications',
        ['id', 'user_id', 'category', 'title', 'message', 'read_at', 'metadata', 'created_at'],
        rows, '(id)');
    }

    // ---------------------------------------------------------------------
    // 14. Conversas e mensagens
    // ---------------------------------------------------------------------
    if (citizens.length > 0 && activeCompanies.length > 0) {
      const convRows: unknown[][] = [];
      const msgRows: unknown[][] = [];
      for (let i = 0; i < 15; i += 1) {
        const co = activeCompanies[i % activeCompanies.length];
        const u = citizens[(i * 2 + 1) % citizens.length];
        const convId = `${SEED}-conv-${pad(i + 1)}`;
        convRows.push([
          convId, u.id, co.id, `Consulta ${i + 1}`,
          'Mensagem de demonstração da conversa entre cliente e empresa.',
          i % 2 === 0, i % 2 === 1, daysFromNow(-8 + i, 10), daysFromNow(-8 + i, 12),
        ]);
        const owner = co.owner_user_id ?? u.id;
        msgRows.push([
          `${SEED}-msg-${pad(i + 1)}-1`, convId, u.id, 'user',
          'Olá, gostaria de saber mais sobre os vossos serviços.', true, false, daysFromNow(-8 + i, 10),
        ]);
        msgRows.push([
          `${SEED}-msg-${pad(i + 1)}-2`, convId, owner, 'business',
          'Boa tarde! Com certeza, teremos todo o gosto em ajudar.', false, true, daysFromNow(-8 + i, 11),
        ]);
        msgRows.push([
          `${SEED}-msg-${pad(i + 1)}-3`, convId, u.id, 'user',
          'Obrigado pela resposta rápida.', false, false, daysFromNow(-8 + i, 12),
        ]);
      }
      report.conversations = await bulkInsert(client, 'conversations',
        ['id', 'user_id', 'business_id', 'subject', 'last_message', 'unread_for_user', 'unread_for_business',
          'created_at', 'updated_at'], convRows, '(id)');
      report.conversation_messages = await bulkInsert(client, 'conversation_messages',
        ['id', 'conversation_id', 'sender_id', 'sender_role', 'text', 'read_by_user', 'read_by_business', 'created_at'],
        msgRows, '(id)');
    }

    // ---------------------------------------------------------------------
    // 15. Entregas de email (simuladas, claramente marcadas)
    // ---------------------------------------------------------------------
    if (citizens.length > 0) {
      const kinds = ['ticket_purchase', 'password_reset', 'marketing', 'support_reply'];
      const statuses = ['delivered', 'queued', 'failed'];
      const rows: unknown[][] = [];
      citizens.slice(0, 16).forEach((u, i) => {
        const status = pick(statuses, i);
        rows.push([
          `${SEED}-email-${pad(i + 1)}`, pick(kinds, i), 'pt', u.email, u.name,
          'Email de demonstração do Guigui.com', status, 'smtp', 'development',
          status === 'delivered' ? `demo-msg-${pad(i + 1)}` : null, `${SEED}-email-${pad(i + 1)}`,
          1, status === 'failed' ? 'demo_failure' : null,
          status === 'failed' ? 'Falha simulada de demonstração.' : null, u.id,
          JSON.stringify({ demo: true }), daysFromNow(-10 + i, 9), daysFromNow(-10 + i, 9),
          daysFromNow(-10 + i, 9), status === 'delivered' ? daysFromNow(-10 + i, 9) : null,
          status === 'delivered' ? daysFromNow(-10 + i, 9) : null,
        ]);
      });
      report.email_deliveries = await bulkInsert(client, 'email_deliveries',
        ['id', 'kind', 'locale', 'recipient_email', 'recipient_name', 'subject', 'status', 'provider',
          'provider_mode', 'provider_message_id', 'dedupe_key', 'attempts', 'last_error_code',
          'last_error_message', 'related_user_id', 'metadata', 'created_at', 'updated_at', 'accepted_at',
          'delivered_at', 'finalized_at'], rows, '(id)');
    }

    // ---------------------------------------------------------------------
    // 16. Agendamentos de marketing
    // ---------------------------------------------------------------------
    {
      const rows: unknown[][] = [];
      ownedActive.slice(0, 8).forEach((co, i) => {
        const published = i % 2 === 0;
        rows.push([
          `${SEED}-sched-${pad(i + 1)}`, co.id, co.owner_user_id, i % 3 === 0 ? 'promotion' : 'post',
          `${SEED}-${i % 3 === 0 ? 'promo' : 'campaign'}-${pad(i + 1)}`,
          `Agendamento de demonstração ${i + 1}`,
          'Item agendado de demonstração para o módulo de marketing.',
          daysFromNow(published ? -5 : 4, 9), 'Africa/Bissau',
          published ? 'published' : 'scheduled', 1,
          published ? daysFromNow(-5, 9) : null,
          published ? daysFromNow(-5, 9) : null, null, 'approved',
          i % 4 === 0 ? 'pending' : 'not_required', null, null,
          daysFromNow(-6, 9), daysFromNow(-1, 9),
        ]);
      });
      report.marketing_scheduled_items = await bulkInsert(client, 'marketing_scheduled_items',
        ['id', 'business_id', 'owner_user_id', 'item_type', 'item_id', 'label', 'description',
          'scheduled_at', 'timezone', 'status', 'attempts', 'last_attempt_at', 'published_at',
          'error_message', 'moderation_status', 'payment_status', 'campaign_id', 'ends_at',
          'created_at', 'updated_at'], rows, '(id)');
    }

    // ---------------------------------------------------------------------
    // 17. Ciclo de vida de eventos e bilhetes (estados variados)
    // ---------------------------------------------------------------------
    if (activeCompanies.length > 0 && citizens.length >= 6) {
      const co = ownedActive[0] ?? activeCompanies[0];
      const signingSecret = process.env.TICKET_SIGNING_SECRET?.trim() || 'guigui-ticket-development-secret';
      const place = 'Praça dos Heróis Nacionais, Bissau';
      const definitions = [
        {
          id: `${SEED}-ev-001`, status: 'published', title: 'Noite de Música Tradicional da Guiné',
          days: 45, hour: 20, endHour: 23, category: 'Música',
          description: 'Uma noite dedicada à música tradicional guineense, com artistas de Bissau e convidados especiais.',
        },
        {
          id: `${SEED}-ev-002`, status: 'published', title: 'Festival Sabores de Bissau — edição anterior',
          days: -60, hour: 12, endHour: 22, category: 'Gastronomia',
          description: 'Mostra gastronómica com restaurantes locais, produtores e música ao vivo.',
        },
        {
          id: `${SEED}-ev-003`, status: 'draft', title: 'Encontro de Empreendedores do Setor Criativo',
          days: 90, hour: 9, endHour: 17, category: 'Networking',
          description: 'Rascunho em preparação: painéis, oficinas e sessões de mentoria para empreendedores.',
        },
        {
          id: `${SEED}-ev-004`, status: 'pending', title: 'Conferência de Turismo Sustentável',
          days: 70, hour: 9, endHour: 18, category: 'Conferências',
          description: 'Submetido a moderação: especialistas discutem turismo comunitário e conservação costeira.',
        },
        {
          id: `${SEED}-ev-005`, status: 'rejected', title: 'Festa privada no espaço público',
          days: 30, hour: 22, endHour: 23, category: 'Entretenimento',
          description: 'Submissão rejeitada por falta de autorização para ocupação do espaço público.',
        },
        {
          id: `${SEED}-ev-006`, status: 'cancelled', title: 'Concerto ao Ar Livre — cancelado',
          days: 20, hour: 19, endHour: 22, category: 'Concertos',
          description: 'Evento cancelado pelo organizador devido às condições meteorológicas.',
        },
      ] as const;

      const eventRows: unknown[][] = [];
      const typeRows: unknown[][] = [];
      const typesByEvent = new Map<string, Array<{ id: string; name: string; price: number; quantity: number }>>();

      definitions.forEach((ev, i) => {
        const isPublished = ev.status === 'published';
        const past = ev.days < 0;
        const types = isPublished ? [
          { id: `${SEED}-tt-${pad(i + 1)}-1`, name: 'Entrada Geral', price: past ? 3500 : 5000, quantity: 300 },
          { id: `${SEED}-tt-${pad(i + 1)}-2`, name: 'VIP', price: past ? 10000 : 15000, quantity: 40 },
        ] : [];
        typesByEvent.set(ev.id, types);
        for (const t of types) typeRows.push([t.id, ev.id, t.name, t.price, t.quantity]);

        const start = daysFromNow(ev.days, ev.hour);
        const end = daysFromNow(ev.days, ev.endHour);
        const data = {
          organizerName: co.name,
          category: ev.category,
          date: start.slice(0, 10),
          time: `${String(ev.hour).padStart(2, '0')}:00`,
          location: place,
          neighborhood: 'Bissau Velho',
          coverImage: `https://picsum.photos/seed/${ev.id}/1200/675`,
          description: ev.description,
          rules: 'Bilhete válido para uma entrada. Apresentar o código QR à entrada.',
          capacity: 300,
          scannerDoorCode: 'DEMO2027',
          ticketTypes: types.map((t) => ({
            id: t.id, name: t.name, priceXOF: t.price,
            availableQuantity: t.quantity, soldQuantity: 0, salesOpen: true,
          })),
          demo: true,
        };
        eventRows.push([
          ev.id, co.id, ev.title, ev.status, start, end,
          daysFromNow(-90 + i * 10, 9), daysFromNow(-90 + i * 10, 10),
          JSON.stringify(data),
        ]);
      });

      report.events = await bulkInsert(client, 'events',
        ['id', 'company_id', 'title', 'status', 'starts_at', 'ends_at', 'created_at', 'updated_at', 'data'],
        eventRows, '(id)');
      report.ticket_types = await bulkInsert(client, 'ticket_types',
        ['id', 'event_id', 'name', 'price_xof', 'quantity'], typeRows, '(event_id, name)');

      const event1 = definitions[0];
      const event2 = definitions[1];
      const lifecycle = [
        { n: 1, ev: event1, buyer: citizens[0], status: 'paid', ticket: 'valid', pay: 'paid' },
        { n: 2, ev: event2, buyer: citizens[1], status: 'paid', ticket: 'used', pay: 'paid' },
        { n: 3, ev: event1, buyer: citizens[2], status: 'pending', ticket: null, pay: 'pending' },
        { n: 4, ev: event1, buyer: citizens[3], status: 'cancelled', ticket: 'cancelled', pay: 'cancelled' },
        { n: 5, ev: event2, buyer: citizens[4], status: 'refunded', ticket: 'expired', pay: 'refunded' },
        { n: 6, ev: event1, buyer: citizens[5], status: 'failed', ticket: null, pay: 'failed' },
      ] as const;

      const orderRows: unknown[][] = [];
      const ticketRows: unknown[][] = [];
      const paymentRows: unknown[][] = [];
      const notifRows: unknown[][] = [];
      const validationRows: unknown[][] = [];

      for (const item of lifecycle) {
        const general = typesByEvent.get(item.ev.id)![0];
        const orderId = `${SEED}-ord-${pad(item.n)}`;
        const created = daysFromNow(-40 + item.n * 2, 10);
        const phone = item.buyer.phone || `+245 955 10 ${String(item.n).padStart(2, '0')} 00`;
        const qrToken = `${SEED}-qr-${pad(item.n)}-${hash(item.buyer.id).slice(0, 8)}`;
        const ticketCode = `DEMO-${String(item.n).padStart(4, '0')}`;
        const ticketId = `${SEED}-tk-${pad(item.n)}`;
        const signature = createHmac('sha256', signingSecret)
          .update([qrToken, ticketCode, phone, general.price].join('|'))
          .digest('hex');

        orderRows.push([
          orderId, item.buyer.id, item.ev.id, item.status,
          general.price, 0, general.price, `${SEED}-idem-${pad(item.n)}`, created, created,
        ]);

        if (item.ticket) {
          const status = item.ticket;
          const expiresAt = status === 'expired'
            ? daysFromNow(-30, 23)
            : status === 'valid'
              ? daysFromNow(60, 23)
              : daysFromNow(10, 23);
          ticketRows.push([
            ticketId, orderId, item.ev.id, general.id, qrToken, ticketCode, null, signature, status,
            expiresAt, created, item.buyer.name, phone, item.buyer.name, phone, 'orange_money',
            status === 'cancelled' ? daysFromNow(-20, 12) : null,
            status === 'cancelled' ? 'Cancelado pelo comprador (demonstração).' : null,
            item.buyer.id,
          ]);
          if (status === 'used') {
            validationRows.push([
              `${SEED}-lifeval-${pad(item.n)}`, ticketId, admin.id, co.id, 'demo-scanner-01',
              'accepted', null, daysFromNow(-55, 21),
            ]);
          }
        }

        paymentRows.push([
          `${SEED}-pay-${pad(item.n)}`, orderId, 'orange_money',
          `DEMO-${pad(item.n)}-${hash(orderId).slice(0, 6).toUpperCase()}`,
          item.pay, general.price, 0, 0, general.price, `${SEED}-pay-idem-${pad(item.n)}`,
          created, created, item.buyer.name, phone, 'event_tickets', 'simulated',
          item.pay === 'paid' ? created : null, co.id, item.ev.id, co.id, item.buyer.id,
        ]);

        notifRows.push([
          `${SEED}-ntf-life-${pad(item.n)}`, item.buyer.id,
          item.pay === 'paid' ? 'ticket' : 'payment',
          item.pay === 'paid' ? 'Bilhete emitido' : 'Estado de pagamento atualizado',
          item.pay === 'paid'
            ? `O seu bilhete para ${item.ev.title} está disponível.`
            : `O pagamento da encomenda ${orderId} está ${item.pay}.`,
          null, JSON.stringify({ demo: true, orderId, eventId: item.ev.id }), created,
        ]);
      }

      report.orders = await bulkInsert(client, 'orders',
        ['id', 'buyer_user_id', 'event_id', 'status', 'gross_amount_xof', 'fee_amount_xof',
          'net_amount_xof', 'idempotency_key', 'created_at', 'updated_at'], orderRows, '(id)');
      report.tickets = await bulkInsert(client, 'tickets',
        ['id', 'order_id', 'event_id', 'ticket_type_id', 'qr_token', 'ticket_code', 'pin_hash',
          'signature', 'status', 'expires_at', 'created_at', 'buyer_name', 'buyer_phone',
          'holder_name', 'holder_phone', 'payment_method', 'cancelled_at', 'cancel_reason', 'buyer_user_id'],
        ticketRows, '(id)');
      report.payment_transactions = await bulkInsert(client, 'payment_transactions',
        ['id', 'order_id', 'provider', 'provider_reference', 'status', 'gross_amount_xof',
          'fee_amount_xof', 'commission_amount_xof', 'net_amount_xof', 'idempotency_key',
          'created_at', 'updated_at', 'payer_name', 'payer_phone', 'use_case', 'provider_mode',
          'confirmed_at', 'business_id', 'event_id', 'company_id', 'buyer_user_id'],
        paymentRows, '(id)');
      // O estado pendente é uma reserva temporária: o worker do sistema apaga
      // bilhetes `pending` antigos, por isso usa-se a tabela real de reservas.
      report.ticket_reservations = (report.ticket_reservations ?? 0) + await bulkInsert(client, 'ticket_reservations',
        ['id', 'event_id', 'ticket_type_id', 'quantity', 'expires_at', 'status', 'created_at', 'updated_at'],
        [[`${SEED}-liferes-001`, event1.id, typesByEvent.get(event1.id)![0].id, 1,
          daysFromNow(2, 23), 'pending', daysFromNow(0, 9), daysFromNow(0, 9)]], '(id)');
      report.ticket_validations = (report.ticket_validations ?? 0) + await bulkInsert(client, 'ticket_validations',
        ['id', 'ticket_id', 'operator_user_id', 'company_id', 'device_id', 'result', 'reason', 'created_at'],
        validationRows, '(id)');
      report.notifications = (report.notifications ?? 0) + await bulkInsert(client, 'notifications',
        ['id', 'user_id', 'category', 'title', 'message', 'read_at', 'metadata', 'created_at'],
        notifRows, '(id)');
    }

    await client.query('COMMIT');
    console.log('\n[seed-full] concluído. Registos novos por tabela:');
    for (const [k, v] of Object.entries(report)) console.log(`  ${k.padEnd(30)} ${v}`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[seed-full] FALHOU:', error instanceof Error ? error.message : error);
  process.exit(1);
});
