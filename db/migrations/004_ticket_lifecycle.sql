-- Secção 7 / GUI-3.4.10 e GUI-3.4.11: cancelamento e reembolso de bilhetes.
--
-- Fica separada de `refunds` porque essa tabela está ligada a `payment_transactions`
-- e um bilhete emitido na compra de evento nem sempre tem uma transacção associada.
-- O estado `requested` significa "pedido registado": a devolução efectiva ao
-- operador de mobile money ainda depende do gateway comercial e não é automática.

CREATE TABLE IF NOT EXISTS ticket_refunds (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id) ON DELETE RESTRICT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  amount_xof INTEGER NOT NULL CHECK (amount_xof > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'processed', 'failed')),
  requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ticket_refunds_company_idx ON ticket_refunds(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ticket_refunds_ticket_idx ON ticket_refunds(ticket_id);

-- Motivo e instante do cancelamento, para auditoria posterior do bilhete.
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
