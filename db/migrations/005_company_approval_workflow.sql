-- Guigui.com — persistência do workflow de aprovação empresarial
-- Executar depois das migrações 001–004 numa base PostgreSQL real.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS review_decision TEXT CHECK (review_decision IN ('approve', 'reject'));
ALTER TABLE companies ADD COLUMN IF NOT EXISTS review_reason TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS companies_pending_created_idx ON companies (created_at) WHERE status = 'pending';
