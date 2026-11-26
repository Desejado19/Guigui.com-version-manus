-- Auditoria e Qualidade do Sistema
-- Execuções reais, verificações automáticas e problemas com histórico de estado.
-- Não altera dados operacionais nem substitui os logs de auditoria existentes.

CREATE TABLE IF NOT EXISTS quality_audit_runs (
  id TEXT PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  triggered_by TEXT NOT NULL DEFAULT 'system',
  environment TEXT NOT NULL DEFAULT 'unknown',
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  checks JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quality_audit_findings (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES quality_audit_runs(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  module TEXT NOT NULL,
  screen TEXT,
  element TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  steps TEXT,
  expected_result TEXT,
  actual_result TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'identified' CHECK (status IN ('identified', 'analyzing', 'fixing', 'fixed', 'validating', 'resolved', 'reopened')),
  cause TEXT,
  fix_applied TEXT,
  owner TEXT,
  identified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  retest_result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, code)
);

CREATE INDEX IF NOT EXISTS quality_audit_runs_started_idx
  ON quality_audit_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS quality_audit_findings_run_idx
  ON quality_audit_findings (run_id, priority, status);

CREATE INDEX IF NOT EXISTS quality_audit_findings_status_idx
  ON quality_audit_findings (status, priority, updated_at DESC);
