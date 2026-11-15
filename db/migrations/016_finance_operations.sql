-- Módulo Financeiro: operações administrativas persistentes, separadas por âmbito.
-- Nenhum dado de pagamento existente é convertido ou reinterpretado por esta migração.

CREATE TABLE IF NOT EXISTS payment_reconciliations (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL UNIQUE REFERENCES payment_transactions(id) ON DELETE RESTRICT,
  statement_reference TEXT NOT NULL,
  expected_amount_xof INTEGER NOT NULL CHECK (expected_amount_xof >= 0),
  statement_amount_xof INTEGER NOT NULL CHECK (statement_amount_xof >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_review', 'reconciled', 'divergence', 'unconfirmed')),
  notes TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_reconciliations_status_idx
  ON payment_reconciliations(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS payment_manual_actions (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES payment_transactions(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('confirm', 'reject', 'request_proof')),
  reason TEXT,
  proof_reference TEXT,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_manual_actions_transaction_idx
  ON payment_manual_actions(transaction_id, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_operator_configs (
  provider TEXT PRIMARY KEY CHECK (provider IN ('orange_money', 'telecel', 'manual_transfer')),
  dedicated_phone TEXT,
  integration_status TEXT NOT NULL DEFAULT 'negotiation'
    CHECK (integration_status IN ('negotiation', 'sandbox', 'production', 'manual')),
  api_base_url TEXT,
  webhook_path TEXT,
  api_version TEXT,
  supports_auto_push_otp BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO payment_operator_configs (provider, dedicated_phone, integration_status, api_version, supports_auto_push_otp, notes)
VALUES
  ('orange_money', '+245 955 00 00', 'negotiation', 'v1', TRUE, 'Integração em negociação comercial; operação manual disponível.'),
  ('telecel', '+245 966 00 00', 'negotiation', 'v1', TRUE, 'Integração em negociação comercial; operação manual disponível.'),
  ('manual_transfer', NULL, 'manual', NULL, FALSE, 'Transferência bancária ou depósito confirmado por comprovativo.')
ON CONFLICT (provider) DO NOTHING;

-- A tabela `refunds` já existia para pagamentos da plataforma. Passa a suportar
-- o ciclo autorização -> processamento, rejeição e estorno, mantendo a ligação
-- obrigatória à transação original.
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_status_check;
ALTER TABLE refunds ADD CONSTRAINT refunds_status_check
  CHECK (status IN ('requested', 'authorized', 'processed', 'rejected', 'failed'));

ALTER TABLE refunds ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'refund';
ALTER TABLE refunds DROP CONSTRAINT IF EXISTS refunds_kind_check;
ALTER TABLE refunds ADD CONSTRAINT refunds_kind_check CHECK (kind IN ('refund', 'reversal'));
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS original_reference TEXT;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS provider_reference TEXT;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS requested_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS authorized_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS processed_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS authorized_at TIMESTAMPTZ;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS refunds_transaction_idx ON refunds(transaction_id, created_at DESC);
CREATE INDEX IF NOT EXISTS refunds_status_idx ON refunds(status, created_at DESC);
