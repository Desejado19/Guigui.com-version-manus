CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  last_message TEXT,
  unread_for_user BOOLEAN NOT NULL DEFAULT FALSE,
  unread_for_business BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, business_id)
);

ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS business_id TEXT;
CREATE INDEX IF NOT EXISTS support_tickets_business_idx ON support_tickets(business_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS conversations_user_idx ON conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS conversations_business_idx ON conversations(business_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'business')),
  text TEXT NOT NULL,
  read_by_user BOOLEAN NOT NULL DEFAULT FALSE,
  read_by_business BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conversation_messages_conversation_idx ON conversation_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS support_replies (
  id TEXT PRIMARY KEY,
  support_ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'business', 'admin')),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_replies_ticket_idx ON support_replies(support_ticket_id, created_at);
