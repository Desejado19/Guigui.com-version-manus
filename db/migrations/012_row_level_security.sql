-- 012 — Row Level Security para as tabelas principais.
--
-- Contexto: a aplicação liga-se como `postgres` (superuser, BYPASSRLS), pelo que
-- a separação de dados entre cidadãos e empresas dependia apenas do código
-- Express. Esta migração cria um papel de aplicação sem privilégios, activa RLS
-- com FORCE (aplica-se também ao dono da tabela) e define políticas que usam a
-- identidade do pedido:
--
--   app.user_id      → id do utilizador autenticado ('' sem sessão)
--   app.role         → 'user' | 'business' | 'admin' | 'anon'
--   app.business_id  → empresa da sessão (só para role = 'business')
--
-- O runtime faz `SET LOCAL ROLE guigui_app` + `set_config(..., true)` dentro de
-- uma transacção por consulta (server/db.ts). O papel `postgres` continua a ser
-- usado para arranque de autenticação (login/registo) e tarefas de sistema.

BEGIN;

-- 1. Papel de aplicação: sem login directo, sem superuser, sem BYPASSRLS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guigui_app') THEN
    CREATE ROLE guigui_app NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
  ELSE
    ALTER ROLE guigui_app NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO guigui_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO guigui_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO guigui_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO guigui_app;

-- 2. Leitura da identidade do pedido. Sem valor definido devolve '' (nega tudo).
CREATE OR REPLACE FUNCTION app_user_id() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT COALESCE(current_setting('app.user_id', true), '') $$;

CREATE OR REPLACE FUNCTION app_role() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT COALESCE(current_setting('app.role', true), '') $$;

CREATE OR REPLACE FUNCTION app_business_id() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT COALESCE(current_setting('app.business_id', true), '') $$;

CREATE OR REPLACE FUNCTION app_is_admin() RETURNS boolean
  LANGUAGE sql STABLE AS $$ SELECT COALESCE(current_setting('app.role', true), '') = 'admin' $$;

-- 3. Activar RLS (com FORCE, para valer também para o dono das tabelas).
ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                  FORCE ROW LEVEL SECURITY;
ALTER TABLE companies              ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies              FORCE ROW LEVEL SECURITY;
ALTER TABLE company_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members        FORCE ROW LEVEL SECURITY;
ALTER TABLE events                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE events                 FORCE ROW LEVEL SECURITY;
ALTER TABLE ticket_types           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types           FORCE ROW LEVEL SECURITY;
ALTER TABLE orders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                 FORCE ROW LEVEL SECURITY;
ALTER TABLE tickets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets                FORCE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions   FORCE ROW LEVEL SECURITY;
ALTER TABLE support_tickets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets        FORCE ROW LEVEL SECURITY;
ALTER TABLE support_replies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_replies        FORCE ROW LEVEL SECURITY;
ALTER TABLE notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications          FORCE ROW LEVEL SECURITY;
ALTER TABLE conversations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations          FORCE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages  FORCE ROW LEVEL SECURITY;
ALTER TABLE moderation_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_items       FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs             FORCE ROW LEVEL SECURITY;
ALTER TABLE monetization_wallets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE monetization_wallets   FORCE ROW LEVEL SECURITY;
ALTER TABLE monetization_ledger    ENABLE ROW LEVEL SECURITY;
ALTER TABLE monetization_ledger    FORCE ROW LEVEL SECURITY;
ALTER TABLE categories             ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories             FORCE ROW LEVEL SECURITY;

-- 4. Políticas por tabela.

-- users: cada conta vê-se a si própria; empresa vê os membros da sua equipa.
DROP POLICY IF EXISTS users_admin ON users;
CREATE POLICY users_admin ON users FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS users_self_select ON users;
CREATE POLICY users_self_select ON users FOR SELECT TO guigui_app
  USING (id = app_user_id());

DROP POLICY IF EXISTS users_self_update ON users;
CREATE POLICY users_self_update ON users FOR UPDATE TO guigui_app
  USING (id = app_user_id()) WITH CHECK (id = app_user_id());

DROP POLICY IF EXISTS users_team_select ON users;
CREATE POLICY users_team_select ON users FOR SELECT TO guigui_app
  USING (EXISTS (
    SELECT 1 FROM company_members cm
    WHERE cm.user_id = users.id AND cm.company_id = app_business_id()
  ));

-- users (clientes): a empresa precisa do nome de quem lhe compra bilhetes,
-- abre conversas ou pede apoio. Só é visível através dessa relação comercial.
DROP POLICY IF EXISTS users_business_clients_select ON users;
CREATE POLICY users_business_clients_select ON users FOR SELECT TO guigui_app
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.user_id = users.id AND c.business_id = app_business_id()
    )
    OR EXISTS (
      SELECT 1 FROM orders o JOIN events e ON e.id = o.event_id
      WHERE o.buyer_user_id = users.id AND e.company_id = app_business_id()
    )
    OR EXISTS (
      SELECT 1 FROM support_tickets st
      WHERE st.requester_user_id = users.id AND st.business_id = app_business_id()
    )
  );

-- companies: leitura pública das aprovadas; empresa vê a sua; admin tudo.
DROP POLICY IF EXISTS companies_admin ON companies;
CREATE POLICY companies_admin ON companies FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS companies_public_read ON companies;
CREATE POLICY companies_public_read ON companies FOR SELECT TO guigui_app
  USING (status IN ('approved', 'active'));

DROP POLICY IF EXISTS companies_owner_read ON companies;
CREATE POLICY companies_owner_read ON companies FOR SELECT TO guigui_app
  USING (owner_user_id = app_user_id() OR id = app_business_id());

DROP POLICY IF EXISTS companies_owner_write ON companies;
CREATE POLICY companies_owner_write ON companies FOR INSERT TO guigui_app
  WITH CHECK (owner_user_id = app_user_id());

DROP POLICY IF EXISTS companies_owner_update ON companies;
CREATE POLICY companies_owner_update ON companies FOR UPDATE TO guigui_app
  USING (owner_user_id = app_user_id() OR id = app_business_id())
  WITH CHECK (owner_user_id = app_user_id() OR id = app_business_id());

-- company_members: cada membro vê a sua linha; empresa vê e gere a equipa.
DROP POLICY IF EXISTS company_members_admin ON company_members;
CREATE POLICY company_members_admin ON company_members FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS company_members_read ON company_members;
CREATE POLICY company_members_read ON company_members FOR SELECT TO guigui_app
  USING (user_id = app_user_id() OR company_id = app_business_id());

DROP POLICY IF EXISTS company_members_write ON company_members;
CREATE POLICY company_members_write ON company_members FOR ALL TO guigui_app
  USING (company_id = app_business_id()) WITH CHECK (company_id = app_business_id());

-- events: publicado é público; empresa gere os seus.
DROP POLICY IF EXISTS events_admin ON events;
CREATE POLICY events_admin ON events FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS events_public_read ON events;
CREATE POLICY events_public_read ON events FOR SELECT TO guigui_app
  USING (status = 'published');

DROP POLICY IF EXISTS events_business_read ON events;
CREATE POLICY events_business_read ON events FOR SELECT TO guigui_app
  USING (company_id = app_business_id());

DROP POLICY IF EXISTS events_business_write ON events;
CREATE POLICY events_business_write ON events FOR ALL TO guigui_app
  USING (company_id = app_business_id()) WITH CHECK (company_id = app_business_id());

-- ticket_types: público para eventos publicados; empresa gere os seus.
DROP POLICY IF EXISTS ticket_types_admin ON ticket_types;
CREATE POLICY ticket_types_admin ON ticket_types FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS ticket_types_read ON ticket_types;
CREATE POLICY ticket_types_read ON ticket_types FOR SELECT TO guigui_app
  USING (EXISTS (
    SELECT 1 FROM events e WHERE e.id = ticket_types.event_id
      AND (e.status = 'published' OR e.company_id = app_business_id())
  ));

DROP POLICY IF EXISTS ticket_types_write ON ticket_types;
CREATE POLICY ticket_types_write ON ticket_types FOR ALL TO guigui_app
  USING (EXISTS (SELECT 1 FROM events e WHERE e.id = ticket_types.event_id AND e.company_id = app_business_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM events e WHERE e.id = ticket_types.event_id AND e.company_id = app_business_id()));

-- orders: cidadão vê as suas compras; empresa vê as dos seus eventos.
DROP POLICY IF EXISTS orders_admin ON orders;
CREATE POLICY orders_admin ON orders FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS orders_read ON orders;
CREATE POLICY orders_read ON orders FOR SELECT TO guigui_app
  USING (
    buyer_user_id = app_user_id()
    OR event_id IN (SELECT e.id FROM events e WHERE e.company_id = app_business_id())
  );

DROP POLICY IF EXISTS orders_insert ON orders;
CREATE POLICY orders_insert ON orders FOR INSERT TO guigui_app
  WITH CHECK (
    buyer_user_id = app_user_id()
    OR event_id IN (SELECT e.id FROM events e WHERE e.company_id = app_business_id())
  );

DROP POLICY IF EXISTS orders_update ON orders;
CREATE POLICY orders_update ON orders FOR UPDATE TO guigui_app
  USING (
    buyer_user_id = app_user_id()
    OR event_id IN (SELECT e.id FROM events e WHERE e.company_id = app_business_id())
  )
  WITH CHECK (
    buyer_user_id = app_user_id()
    OR event_id IN (SELECT e.id FROM events e WHERE e.company_id = app_business_id())
  );

-- tickets: cidadão pelos seus pedidos; empresa pelos eventos que organiza.
DROP POLICY IF EXISTS tickets_admin ON tickets;
CREATE POLICY tickets_admin ON tickets FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS tickets_read ON tickets;
CREATE POLICY tickets_read ON tickets FOR SELECT TO guigui_app
  USING (
    order_id IN (SELECT o.id FROM orders o WHERE o.buyer_user_id = app_user_id())
    OR event_id IN (SELECT e.id FROM events e WHERE e.company_id = app_business_id())
  );

DROP POLICY IF EXISTS tickets_write ON tickets;
CREATE POLICY tickets_write ON tickets FOR ALL TO guigui_app
  USING (
    order_id IN (SELECT o.id FROM orders o WHERE o.buyer_user_id = app_user_id())
    OR event_id IN (SELECT e.id FROM events e WHERE e.company_id = app_business_id())
  )
  WITH CHECK (
    order_id IN (SELECT o.id FROM orders o WHERE o.buyer_user_id = app_user_id())
    OR event_id IN (SELECT e.id FROM events e WHERE e.company_id = app_business_id())
  );

-- payment_transactions: derivado do pedido (cidadão) ou do evento (empresa).
DROP POLICY IF EXISTS payment_transactions_admin ON payment_transactions;
CREATE POLICY payment_transactions_admin ON payment_transactions FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS payment_transactions_read ON payment_transactions;
CREATE POLICY payment_transactions_read ON payment_transactions FOR SELECT TO guigui_app
  USING (order_id IN (
    SELECT o.id FROM orders o
    WHERE o.buyer_user_id = app_user_id()
       OR o.event_id IN (SELECT e.id FROM events e WHERE e.company_id = app_business_id())
  ));

DROP POLICY IF EXISTS payment_transactions_write ON payment_transactions;
CREATE POLICY payment_transactions_write ON payment_transactions FOR ALL TO guigui_app
  USING (order_id IN (
    SELECT o.id FROM orders o
    WHERE o.buyer_user_id = app_user_id()
       OR o.event_id IN (SELECT e.id FROM events e WHERE e.company_id = app_business_id())
  ))
  WITH CHECK (order_id IN (
    SELECT o.id FROM orders o
    WHERE o.buyer_user_id = app_user_id()
       OR o.event_id IN (SELECT e.id FROM events e WHERE e.company_id = app_business_id())
  ));

-- support_tickets: autor vê o seu; empresa vê os da empresa; admin tudo.
DROP POLICY IF EXISTS support_tickets_admin ON support_tickets;
CREATE POLICY support_tickets_admin ON support_tickets FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS support_tickets_read ON support_tickets;
CREATE POLICY support_tickets_read ON support_tickets FOR SELECT TO guigui_app
  USING (requester_user_id = app_user_id() OR business_id = app_business_id());

DROP POLICY IF EXISTS support_tickets_insert ON support_tickets;
CREATE POLICY support_tickets_insert ON support_tickets FOR INSERT TO guigui_app
  WITH CHECK (requester_user_id = app_user_id() OR business_id = app_business_id());

DROP POLICY IF EXISTS support_tickets_update ON support_tickets;
CREATE POLICY support_tickets_update ON support_tickets FOR UPDATE TO guigui_app
  USING (requester_user_id = app_user_id() OR business_id = app_business_id())
  WITH CHECK (requester_user_id = app_user_id() OR business_id = app_business_id());

-- support_replies: visibilidade herdada do pedido.
DROP POLICY IF EXISTS support_replies_admin ON support_replies;
CREATE POLICY support_replies_admin ON support_replies FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS support_replies_read ON support_replies;
CREATE POLICY support_replies_read ON support_replies FOR SELECT TO guigui_app
  USING (EXISTS (
    SELECT 1 FROM support_tickets st WHERE st.id = support_replies.support_ticket_id
      AND (st.requester_user_id = app_user_id() OR st.business_id = app_business_id())
  ));

DROP POLICY IF EXISTS support_replies_insert ON support_replies;
CREATE POLICY support_replies_insert ON support_replies FOR INSERT TO guigui_app
  WITH CHECK (EXISTS (
    SELECT 1 FROM support_tickets st WHERE st.id = support_replies.support_ticket_id
      AND (st.requester_user_id = app_user_id() OR st.business_id = app_business_id())
  ));

-- notifications: cada um vê as suas; o sistema pode inserir para qualquer um.
DROP POLICY IF EXISTS notifications_admin ON notifications;
CREATE POLICY notifications_admin ON notifications FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS notifications_own_read ON notifications;
CREATE POLICY notifications_own_read ON notifications FOR SELECT TO guigui_app
  USING (user_id = app_user_id());

DROP POLICY IF EXISTS notifications_own_update ON notifications;
CREATE POLICY notifications_own_update ON notifications FOR UPDATE TO guigui_app
  USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());

DROP POLICY IF EXISTS notifications_insert ON notifications;
CREATE POLICY notifications_insert ON notifications FOR INSERT TO guigui_app
  WITH CHECK (true);

-- conversations / mensagens: participantes apenas.
DROP POLICY IF EXISTS conversations_admin ON conversations;
CREATE POLICY conversations_admin ON conversations FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS conversations_participant ON conversations;
CREATE POLICY conversations_participant ON conversations FOR ALL TO guigui_app
  USING (user_id = app_user_id() OR business_id = app_business_id())
  WITH CHECK (user_id = app_user_id() OR business_id = app_business_id());

DROP POLICY IF EXISTS conversation_messages_admin ON conversation_messages;
CREATE POLICY conversation_messages_admin ON conversation_messages FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS conversation_messages_participant ON conversation_messages;
CREATE POLICY conversation_messages_participant ON conversation_messages FOR ALL TO guigui_app
  USING (EXISTS (
    SELECT 1 FROM conversations c WHERE c.id = conversation_messages.conversation_id
      AND (c.user_id = app_user_id() OR c.business_id = app_business_id())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM conversations c WHERE c.id = conversation_messages.conversation_id
      AND (c.user_id = app_user_id() OR c.business_id = app_business_id())
  ));

-- moderation_items: empresa vê os seus conteúdos; admin decide.
DROP POLICY IF EXISTS moderation_items_admin ON moderation_items;
CREATE POLICY moderation_items_admin ON moderation_items FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS moderation_items_business ON moderation_items;
CREATE POLICY moderation_items_business ON moderation_items FOR ALL TO guigui_app
  USING (company_id = app_business_id()) WITH CHECK (company_id = app_business_id());

-- audit_logs: escrever é permitido, ler é só para administração.
DROP POLICY IF EXISTS audit_logs_admin ON audit_logs;
CREATE POLICY audit_logs_admin ON audit_logs FOR SELECT TO guigui_app
  USING (app_is_admin());

DROP POLICY IF EXISTS audit_logs_insert ON audit_logs;
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT TO guigui_app
  WITH CHECK (true);

-- monetização: carteira e razão da própria empresa; admin tudo.
DROP POLICY IF EXISTS monetization_wallets_admin ON monetization_wallets;
CREATE POLICY monetization_wallets_admin ON monetization_wallets FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS monetization_wallets_business ON monetization_wallets;
CREATE POLICY monetization_wallets_business ON monetization_wallets FOR ALL TO guigui_app
  USING (business_id = app_business_id()) WITH CHECK (business_id = app_business_id());

DROP POLICY IF EXISTS monetization_ledger_admin ON monetization_ledger;
CREATE POLICY monetization_ledger_admin ON monetization_ledger FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS monetization_ledger_owner ON monetization_ledger;
CREATE POLICY monetization_ledger_owner ON monetization_ledger FOR SELECT TO guigui_app
  USING (business_id = app_business_id() OR user_id = app_user_id());

-- categories: catálogo é público; escrita só para administração.
DROP POLICY IF EXISTS categories_admin ON categories;
CREATE POLICY categories_admin ON categories FOR ALL TO guigui_app
  USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS categories_public_read ON categories;
CREATE POLICY categories_public_read ON categories FOR SELECT TO guigui_app
  USING (true);

COMMIT;
