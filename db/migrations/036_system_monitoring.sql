-- 036_system_monitoring.sql
-- Monitorização técnica do Guigui.com.
--
-- Estas tabelas guardam apenas o que o runtime consegue medir de facto:
-- amostras do processo/host e do PostgreSQL, crescimento diário das tabelas,
-- incidentes geridos pela administração, logs técnicos e a configuração de
-- monitorização. Não existem valores semeados nem métricas fictícias.

CREATE TABLE IF NOT EXISTS system_metric_samples (
  id BIGSERIAL PRIMARY KEY,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cpu_percent NUMERIC(6,2),
  system_cpu_percent NUMERIC(6,2),
  rss_bytes BIGINT,
  heap_used_bytes BIGINT,
  memory_used_percent NUMERIC(6,2),
  db_healthy BOOLEAN NOT NULL DEFAULT FALSE,
  db_latency_ms NUMERIC(10,2),
  db_connections INTEGER,
  db_size_bytes BIGINT,
  requests_today BIGINT,
  errors_today BIGINT
);

CREATE INDEX IF NOT EXISTS system_metric_samples_captured_idx
  ON system_metric_samples (captured_at DESC);

-- Fotografia diária do tamanho das tabelas: permite calcular crescimento real
-- em vez de o estimar. A chave evita duplicados no mesmo dia.
CREATE TABLE IF NOT EXISTS system_table_metrics (
  captured_on DATE NOT NULL,
  table_name TEXT NOT NULL,
  total_bytes BIGINT NOT NULL CHECK (total_bytes >= 0),
  row_estimate BIGINT NOT NULL DEFAULT 0 CHECK (row_estimate >= 0),
  PRIMARY KEY (captured_on, table_name)
);

CREATE TABLE IF NOT EXISTS system_incidents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'operational',
  severity TEXT NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info', 'warning', 'critical')),
  service TEXT NOT NULL DEFAULT 'platform',
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'resolved')),
  impact TEXT NOT NULL DEFAULT '',
  probable_cause TEXT NOT NULL DEFAULT '',
  resolution TEXT NOT NULL DEFAULT '',
  assigned_to TEXT,
  dedupe_key TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Um alerta automático tem no máximo um incidente aberto por chave. Depois de
-- resolvido, a mesma condição pode voltar a abrir um novo incidente.
CREATE UNIQUE INDEX IF NOT EXISTS system_incidents_open_dedupe_idx
  ON system_incidents (dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status <> 'resolved';

CREATE INDEX IF NOT EXISTS system_incidents_status_idx
  ON system_incidents (status, severity, detected_at DESC);

CREATE TABLE IF NOT EXISTS system_incident_events (
  id BIGSERIAL PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES system_incidents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  actor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS system_incident_events_incident_idx
  ON system_incident_events (incident_id, created_at ASC);

CREATE TABLE IF NOT EXISTS system_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level TEXT NOT NULL DEFAULT 'info'
    CHECK (level IN ('debug', 'info', 'warn', 'error')),
  service TEXT NOT NULL DEFAULT 'api',
  route TEXT,
  message TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id TEXT,
  trace_id TEXT,
  status_code INTEGER,
  duration_ms NUMERIC(10,2)
);

CREATE INDEX IF NOT EXISTS system_logs_created_idx
  ON system_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS system_logs_request_idx
  ON system_logs (request_id);
CREATE INDEX IF NOT EXISTS system_logs_level_idx
  ON system_logs (level, created_at DESC);

CREATE TABLE IF NOT EXISTS system_monitoring_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  interval_seconds INTEGER NOT NULL DEFAULT 60
    CHECK (interval_seconds BETWEEN 10 AND 3600),
  cpu_threshold NUMERIC(5,2) NOT NULL DEFAULT 85
    CHECK (cpu_threshold BETWEEN 1 AND 100),
  memory_threshold NUMERIC(5,2) NOT NULL DEFAULT 90
    CHECK (memory_threshold BETWEEN 1 AND 100),
  db_latency_threshold_ms INTEGER NOT NULL DEFAULT 500
    CHECK (db_latency_threshold_ms BETWEEN 10 AND 60000),
  error_rate_threshold NUMERIC(5,2) NOT NULL DEFAULT 5
    CHECK (error_rate_threshold BETWEEN 0 AND 100),
  retention_days INTEGER NOT NULL DEFAULT 14
    CHECK (retention_days BETWEEN 1 AND 365),
  slo_target NUMERIC(5,2) NOT NULL DEFAULT 99.5
    CHECK (slo_target BETWEEN 90 AND 100),
  alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT
);

INSERT INTO system_monitoring_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- RLS: leitura reservada à administração. O serviço de monitorização escreve
-- como identidade de sistema (postgres), tal como a trilha de auditoria.
ALTER TABLE system_metric_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metric_samples FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_metric_samples_admin ON system_metric_samples;
CREATE POLICY system_metric_samples_admin ON system_metric_samples FOR SELECT TO guigui_app
  USING (current_setting('app.role', true) = 'admin');

ALTER TABLE system_table_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_table_metrics FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_table_metrics_admin ON system_table_metrics;
CREATE POLICY system_table_metrics_admin ON system_table_metrics FOR SELECT TO guigui_app
  USING (current_setting('app.role', true) = 'admin');

ALTER TABLE system_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_incidents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_incidents_admin ON system_incidents;
CREATE POLICY system_incidents_admin ON system_incidents FOR SELECT TO guigui_app
  USING (current_setting('app.role', true) = 'admin');

ALTER TABLE system_incident_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_incident_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_incident_events_admin ON system_incident_events;
CREATE POLICY system_incident_events_admin ON system_incident_events FOR SELECT TO guigui_app
  USING (current_setting('app.role', true) = 'admin');

ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_logs_admin ON system_logs;
CREATE POLICY system_logs_admin ON system_logs FOR SELECT TO guigui_app
  USING (current_setting('app.role', true) = 'admin');

ALTER TABLE system_monitoring_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_monitoring_settings FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_monitoring_settings_admin ON system_monitoring_settings;
CREATE POLICY system_monitoring_settings_admin ON system_monitoring_settings FOR SELECT TO guigui_app
  USING (current_setting('app.role', true) = 'admin');
