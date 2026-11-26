-- Arquitetura financeira central: cada cobrança de bilhete fica ligada ao(s)
-- pedido(s) que a originaram e, por essa via, ao evento e à empresa. Os repasses
-- passam a ter registo próprio, com estado real e comprovativo.
-- Migração aditiva: não altera nem apaga transações históricas.

-- 1. Identificação directa na transação (o pedido principal; a ligação completa
--    fica em payment_transaction_orders porque uma compra pode gerar vários
--    pedidos, um por bilhete).
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS event_id TEXT REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS company_id TEXT REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS buyer_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS payment_transactions_event_idx
  ON payment_transactions(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_transactions_company_idx
  ON payment_transactions(company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_transaction_orders (
  transaction_id TEXT NOT NULL REFERENCES payment_transactions(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  amount_xof INTEGER NOT NULL DEFAULT 0 CHECK (amount_xof >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (transaction_id, order_id)
);

CREATE INDEX IF NOT EXISTS payment_transaction_orders_order_idx
  ON payment_transaction_orders(order_id);

-- 2. Os registos históricos que já tinham order_id passam a expor evento e
--    empresa. Os que nunca foram ligados permanecem intactos e são reportados
--    como divergência no financeiro central.
UPDATE payment_transactions t
   SET event_id = o.event_id,
       company_id = e.company_id,
       buyer_user_id = COALESCE(t.buyer_user_id, o.buyer_user_id)
  FROM orders o
  LEFT JOIN events e ON e.id = o.event_id
 WHERE t.order_id = o.id
   AND t.use_case = 'event_tickets'
   AND (t.event_id IS DISTINCT FROM o.event_id
        OR t.company_id IS DISTINCT FROM e.company_id
        OR t.buyer_user_id IS NULL);

INSERT INTO payment_transaction_orders (transaction_id, order_id, amount_xof)
SELECT t.id, t.order_id, COALESCE(o.gross_amount_xof, 0)
  FROM payment_transactions t
  JOIN orders o ON o.id = t.order_id
 WHERE t.use_case = 'event_tickets'
ON CONFLICT (transaction_id, order_id) DO NOTHING;

-- 3. Validação na base de dados: um pagamento de bilhete confirmado não pode
--    existir sem pedido, evento e empresa coerentes.
CREATE OR REPLACE FUNCTION validate_ticket_payment_traceability()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_event_id TEXT;
  v_company_id TEXT;
BEGIN
  IF NEW.use_case = 'event_tickets' AND NEW.status IN ('paid', 'authorized') THEN
    IF NEW.order_id IS NULL THEN
      RAISE EXCEPTION 'Pagamento de bilhete confirmado sem pedido associado (transação %).', NEW.id
        USING ERRCODE = '23514';
    END IF;
    SELECT o.event_id, e.company_id INTO v_event_id, v_company_id
      FROM orders o
      LEFT JOIN events e ON e.id = o.event_id
     WHERE o.id = NEW.order_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Pedido % inexistente para o pagamento %.', NEW.order_id, NEW.id
        USING ERRCODE = '23503';
    END IF;
    IF v_event_id IS NULL THEN
      RAISE EXCEPTION 'Pedido % sem evento: o pagamento % não é rastreável.', NEW.order_id, NEW.id
        USING ERRCODE = '23514';
    END IF;
    IF NEW.event_id IS NOT NULL AND NEW.event_id <> v_event_id THEN
      RAISE EXCEPTION 'Evento do pagamento % não corresponde ao do pedido %.', NEW.id, NEW.order_id
        USING ERRCODE = '23514';
    END IF;
    IF NEW.company_id IS NOT NULL AND NEW.company_id IS DISTINCT FROM v_company_id THEN
      RAISE EXCEPTION 'Empresa do pagamento % não corresponde à do evento %.', NEW.id, NEW.order_id
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_transactions_traceability ON payment_transactions;
CREATE TRIGGER payment_transactions_traceability
BEFORE INSERT OR UPDATE OF use_case, status, order_id, event_id, company_id
ON payment_transactions
FOR EACH ROW EXECUTE FUNCTION validate_ticket_payment_traceability();

-- Uma ligação pedido↔transação também tem de ser coerente com o evento e a
-- empresa registados na transação.
CREATE OR REPLACE FUNCTION validate_payment_order_link()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_order_event TEXT;
  v_company TEXT;
  v_tx_event TEXT;
  v_tx_company TEXT;
BEGIN
  SELECT o.event_id, e.company_id INTO v_order_event, v_company
    FROM orders o LEFT JOIN events e ON e.id = o.event_id
   WHERE o.id = NEW.order_id;
  IF v_order_event IS NULL THEN
    RAISE EXCEPTION 'Pedido % sem evento não pode ser ligado a uma transação.', NEW.order_id
      USING ERRCODE = '23514';
  END IF;
  SELECT event_id, company_id INTO v_tx_event, v_tx_company
    FROM payment_transactions WHERE id = NEW.transaction_id;
  IF v_tx_event IS NOT NULL AND v_tx_event <> v_order_event THEN
    RAISE EXCEPTION 'Pedido % pertence a outro evento.', NEW.order_id
      USING ERRCODE = '23514';
  END IF;
  IF v_tx_company IS NOT NULL AND v_tx_company IS DISTINCT FROM v_company THEN
    RAISE EXCEPTION 'Pedido % pertence a outra empresa.', NEW.order_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_transaction_orders_traceability ON payment_transaction_orders;
CREATE TRIGGER payment_transaction_orders_traceability
BEFORE INSERT OR UPDATE ON payment_transaction_orders
FOR EACH ROW EXECUTE FUNCTION validate_payment_order_link();

-- 4. Repasses às empresas. Nenhum repasse é criado automaticamente: o Super
--    Admin registra a operação e só a confirma com referência/comprovativo.
CREATE TABLE IF NOT EXISTS event_payouts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  amount_xof INTEGER NOT NULL CHECK (amount_xof > 0),
  currency TEXT NOT NULL DEFAULT 'XOF',
  method TEXT NOT NULL CHECK (method IN ('manual_transfer', 'orange_money', 'telecel', 'bank_transfer')),
  reference TEXT,
  proof_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'confirmed', 'failed', 'cancelled')),
  notes TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  confirmed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_payouts_confirmation_evidence CHECK (
    status <> 'confirmed' OR (reference IS NOT NULL AND length(btrim(reference)) >= 3)
  )
);

CREATE INDEX IF NOT EXISTS event_payouts_company_idx
  ON event_payouts(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS event_payouts_event_idx
  ON event_payouts(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS event_payouts_status_idx
  ON event_payouts(status, created_at DESC);

ALTER TABLE event_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_payouts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_payouts_admin_all ON event_payouts;
CREATE POLICY event_payouts_admin_all ON event_payouts
  FOR ALL USING (app_role() = 'admin') WITH CHECK (app_role() = 'admin');

DROP POLICY IF EXISTS event_payouts_business_read ON event_payouts;
CREATE POLICY event_payouts_business_read ON event_payouts
  FOR SELECT USING (company_id = app_business_id() AND app_business_id() <> '');
