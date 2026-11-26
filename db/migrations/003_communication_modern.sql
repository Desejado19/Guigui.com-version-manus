ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS client_message_id TEXT;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS reply_to_message_id TEXT;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text';
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'sent';
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS attachment_name TEXT;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE conversation_messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS conversation_messages_client_id_idx ON conversation_messages(conversation_id, client_message_id) WHERE client_message_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS message_reactions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES conversation_messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id, reaction)
);
CREATE TABLE IF NOT EXISTS conversation_settings (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  muted_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  PRIMARY KEY(conversation_id, user_id)
);
