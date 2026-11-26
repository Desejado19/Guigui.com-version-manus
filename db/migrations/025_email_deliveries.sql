-- Histórico de emails transaccionais e respectivos eventos de estado.
--
-- Uma linha por mensagem lógica. `status` distingue o que a plataforma sabe:
--   queued    -> criada, ainda sem resposta do fornecedor
--   accepted  -> fornecedor aceitou (2xx/250); NÃO significa entregue
--   delivered -> entrega confirmada pelo fornecedor (webhook)
--   bounced / rejected / failed / complained -> falhas, com motivo registado
--
-- `dedupe_key` é única (NULL permite várias linhas): o mesmo email lógico nunca
-- é enviado duas vezes por retry, webhook repetido ou pedido duplicado.
-- O conteúdo (HTML/texto) não é guardado: pode conter tokens de uso único.

CREATE TABLE IF NOT EXISTS email_deliveries (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'pt'
    CHECK (locale IN ('pt', 'fr', 'en', 'es')),
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'accepted', 'delivered', 'bounced', 'rejected', 'failed', 'complained')),
  provider TEXT NOT NULL
    CHECK (provider IN ('brevo', 'smtp')),
  provider_mode TEXT NOT NULL
    CHECK (provider_mode IN ('live', 'development')),
  provider_message_id TEXT,
  dedupe_key TEXT UNIQUE,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error_code TEXT,
  last_error_message TEXT,
  related_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS email_deliveries_status_idx
  ON email_deliveries (status, created_at DESC);
CREATE INDEX IF NOT EXISTS email_deliveries_kind_idx
  ON email_deliveries (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS email_deliveries_recipient_idx
  ON email_deliveries (LOWER(recipient_email), created_at DESC);
CREATE INDEX IF NOT EXISTS email_deliveries_created_idx
  ON email_deliveries (created_at DESC);

-- Registo append-only das transições de estado. Permite ao painel admin
-- mostrar a cronologia (aceite -> entregue -> devolvido) sem perder o motivo.
CREATE TABLE IF NOT EXISTS email_delivery_events (
  id BIGSERIAL PRIMARY KEY,
  delivery_id TEXT NOT NULL REFERENCES email_deliveries(id) ON DELETE CASCADE,
  status TEXT NOT NULL
    CHECK (status IN ('queued', 'accepted', 'delivered', 'bounced', 'rejected', 'failed', 'complained')),
  source TEXT NOT NULL DEFAULT 'dispatcher'
    CHECK (source IN ('dispatcher', 'webhook', 'admin')),
  detail TEXT,
  provider_event TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_delivery_events_delivery_idx
  ON email_delivery_events (delivery_id, occurred_at DESC);
