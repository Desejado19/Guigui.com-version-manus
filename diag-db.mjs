import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const cols = await pool.query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'events' ORDER BY ordinal_position`,
  );
  console.log('EVENTS COLS:', cols.rows.map((c) => `${c.column_name} ${c.data_type}`).join(' | '));

  const tables = await pool.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
  );
  console.log('TABLES:', tables.rows.map((r) => r.tablename).join(', '));

  const idx = await pool.query(
    `SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('conversation_messages','events','ticket_types','conversations')`,
  );
  for (const row of idx.rows) console.log('INDEX:', row.indexname, '=>', row.indexdef);

  const cm = await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'conversation_messages' ORDER BY ordinal_position`,
  );
  console.log('CONV_MSG COLS:', cm.rows.map((c) => `${c.column_name} ${c.data_type}`).join(' | '));

  const companies = await pool.query(`SELECT id, name, status FROM companies ORDER BY id`);
  console.log('COMPANIES:', companies.rows.map((c) => `${c.id}(${c.status})`).join(', ') || '(empty)');

  const events = await pool.query(`SELECT id, company_id, status FROM events ORDER BY id`);
  console.log('EVENTS:', events.rows.map((c) => `${c.id}/${c.company_id}/${c.status}`).join(', ') || '(empty)');

  // Reproduzir o insert de evento exactamente como o servidor faz.
  const payload = {
    id: 'diag-evt-1',
    businessId: 'biz-7',
    title: 'Diag',
    status: 'active',
    date: '2026-10-01',
    time: '18:00 - 23:00',
    ticketTypes: [{ id: 'diag-tt-1', name: 'Entrada Geral', priceXOF: 2500, soldQuantity: 20, availableQuantity: 200 }],
  };
  const startsAt = `${payload.date}T${payload.time.split(' - ')[0]}:00Z`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO events (id, company_id, title, status, starts_at, data, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         company_id = EXCLUDED.company_id,
         title = EXCLUDED.title,
         status = EXCLUDED.status,
         starts_at = EXCLUDED.starts_at,
         data = COALESCE(events.data, '{}'::jsonb) || EXCLUDED.data,
         updated_at = NOW()`,
      [payload.id, payload.businessId || null, payload.title, 'published', startsAt, JSON.stringify(payload)],
    );
    console.log('INSERT EVENT: OK');
    await client.query('ROLLBACK');
  } catch (error) {
    console.log('INSERT EVENT FAILED ->', error.message);
    console.log('   detail:', error.detail, '| code:', error.code, '| constraint:', error.constraint);
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
  } finally {
    client.release();
  }

  // Reproduzir a gravacao real do evento evt-2 (o que a SPA envia).
  const evt2 = {
    id: 'evt-2',
    date: '2026-08-27',
    time: '20:00 - 23:00',
    title: 'Noite de Humor Guineense',
    status: 'active',
    businessId: 'biz-1',
    ticketTypes: [{ id: 'tt-4', name: 'Cadeira Única', priceXOF: 7500, soldQuantity: 180, availableQuantity: 250 }],
  };
  const evt2Client = await pool.connect();
  try {
    await evt2Client.query('BEGIN');
    await evt2Client.query(
      `INSERT INTO events (id, company_id, title, status, starts_at, data, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,NOW(),NOW())
       ON CONFLICT (id) DO UPDATE SET company_id=EXCLUDED.company_id, title=EXCLUDED.title, status=EXCLUDED.status,
         starts_at=EXCLUDED.starts_at, data=COALESCE(events.data,'{}'::jsonb)||EXCLUDED.data, updated_at=NOW()`,
      [evt2.id, evt2.businessId, evt2.title, 'published', `${evt2.date}T${evt2.time.split(' - ')[0]}:00Z`, JSON.stringify(evt2)],
    );
    console.log('INSERT evt-2 event row: OK');
    const existingType = await evt2Client.query('SELECT id FROM ticket_types WHERE event_id=$1 AND name=$2 FOR UPDATE', [evt2.id, evt2.ticketTypes[0].name]);
    console.log('   existing ticket type row:', JSON.stringify(existingType.rows));
    if (existingType.rows[0] && existingType.rows[0].id !== evt2.ticketTypes[0].id) {
      console.log('   => SERVER WOULD THROW: O identificador do tipo de bilhete não pode ser alterado.');
    }
    await evt2Client.query('ROLLBACK');
  } catch (error) {
    console.log('INSERT evt-2 FAILED ->', error.message, '| code:', error.code);
    try { await evt2Client.query('ROLLBACK'); } catch { /* ignore */ }
  } finally {
    evt2Client.release();
  }

  // Listagem de avaliacoes: reproduzir a query exacta do servidor.
  try {
    const reviews = await pool.query(
      `SELECT id, business_id, author_user_id, author_name, author_phone_hash, author_phone_masked,
              qualitative_score, comment, status, moderation_reason, owner_reply, verified_sms, created_at
         FROM reviews WHERE business_id = $1 ORDER BY created_at DESC`,
      ['biz-1'],
    );
    console.log('LIST REVIEWS: OK', reviews.rows.length);
  } catch (error) {
    console.log('LIST REVIEWS FAILED ->', error.message, '| code:', error.code);
  }

  // Todas as avaliacoes existentes e o esquema real da tabela.
  try {
    const schema = await pool.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'reviews' ORDER BY ordinal_position`,
    );
    console.log('REVIEWS COLS:', schema.rows.map((c) => `${c.column_name} ${c.data_type} ${c.is_nullable}`).join(' | '));
    const all = await pool.query('SELECT * FROM reviews LIMIT 20');
    console.log('REVIEWS ROWS:', all.rows.length);
    for (const row of all.rows) {
      console.log('   row:', JSON.stringify(row));
    }
  } catch (error) {
    console.log('REVIEWS SCHEMA FAILED ->', error.message, '| code:', error.code);
  }

  // ON CONFLICT com a predicacao do indice parcial.
  const msgClient2 = await pool.connect();
  try {
    await msgClient2.query('BEGIN');
    await msgClient2.query(
      `INSERT INTO conversation_messages (id, conversation_id, sender_id, sender_role, text, created_at, client_message_id)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6)
       ON CONFLICT (conversation_id, client_message_id) WHERE client_message_id IS NOT NULL DO NOTHING`,
      ['diag-msg-2', 'diag-conv-1', 'diag-user', 'user', 'ola', 'diag-client-2'],
    );
    console.log('INSERT MESSAGE (with partial index predicate): OK');
    await msgClient2.query('ROLLBACK');
  } catch (error) {
    console.log('INSERT MESSAGE (with partial index predicate) FAILED ->', error.message, '| code:', error.code);
    try { await msgClient2.query('ROLLBACK'); } catch { /* ignore */ }
  } finally {
    msgClient2.release();
  }

  // Bilhetes que referenciam o tipo de bilhete legado do evt-2.
  const legacy = await pool.query(
    `SELECT count(*)::int AS total FROM tickets WHERE ticket_type_id = 'ticket-type-TKT-1788055576275-1-C59A'`,
  );
  console.log('TICKETS referencing legacy ticket type:', legacy.rows[0].total);

  // Reproduzir o insert de mensagem de conversa.
  const msgClient = await pool.connect();
  try {
    await msgClient.query('BEGIN');
    await msgClient.query(
      `INSERT INTO conversation_messages (id, conversation_id, sender_id, sender_role, text, created_at, client_message_id)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6)
       ON CONFLICT (conversation_id, client_message_id) DO NOTHING`,
      ['diag-msg-1', 'diag-conv-1', 'diag-user', 'user', 'ola', 'diag-client-1'],
    );
    console.log('INSERT MESSAGE: OK');
    await msgClient.query('ROLLBACK');
  } catch (error) {
    console.log('INSERT MESSAGE FAILED ->', error.message);
    console.log('   detail:', error.detail, '| code:', error.code, '| constraint:', error.constraint);
    try { await msgClient.query('ROLLBACK'); } catch { /* ignore */ }
  } finally {
    msgClient.release();
  }

  await pool.end();
}

main().catch((error) => {
  console.log('ERR', error.message);
  process.exit(1);
});
