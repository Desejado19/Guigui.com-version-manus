ALTER TABLE async_jobs
  ADD COLUMN IF NOT EXISTS lease_token UUID,
  ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS async_jobs_processing_lease_idx
  ON async_jobs (locked_at)
  WHERE status = 'processing';
