-- Secção 8 do Escopo: avaliações qualitativas de 4 níveis (sem estrelas).
-- O peso interno (1..4) nunca é exposto ao público: apenas o rótulo qualitativo.

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  author_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  author_phone_hash TEXT NOT NULL,
  author_phone_masked TEXT NOT NULL,
  qualitative_score TEXT NOT NULL CHECK (qualitative_score IN ('nao_gostei', 'gostei', 'gostei_muito', 'muito_bom')),
  score_weight SMALLINT NOT NULL CHECK (score_weight BETWEEN 1 AND 4),
  comment TEXT CHECK (char_length(comment) <= 200),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('approved', 'pending', 'flagged')),
  moderation_reason TEXT,
  owner_reply TEXT,
  verified_sms BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reviews_business_idx ON reviews(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_status_idx ON reviews(status, created_at DESC);

-- Anti-abuso (Secção 8): um telemóvel só avalia cada negócio uma vez por janela de 90 dias.
-- A unicidade é calculada por "bucket" de 90 dias para permitir reavaliações futuras.
CREATE TABLE IF NOT EXISTS review_antiabuse (
  business_id TEXT NOT NULL,
  author_phone_hash TEXT NOT NULL,
  window_bucket TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (business_id, author_phone_hash, window_bucket)
);

CREATE INDEX IF NOT EXISTS review_antiabuse_phone_idx ON review_antiabuse(author_phone_hash, created_at DESC);

-- Older deployments may store legacy reviews in companies.data; fresh schemas do not.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'data'
  ) THEN
    EXECUTE $migration$
      INSERT INTO reviews (id, business_id, author_name, author_phone_hash, author_phone_masked, qualitative_score, score_weight, comment, status, verified_sms, created_at)
      SELECT
        gen_random_uuid()::text,
        c.id,
        COALESCE(NULLIF(c.data->'reviews', 'null'::jsonb)->0->>'authorName', 'Cliente Guigui'),
        'legacy:' || c.id,
        '+245 ***',
        CASE COALESCE(NULLIF(c.data->'reviews', 'null'::jsonb)->0->>'qualitativeScore', 'gostei')
          WHEN 'nao_gostei' THEN 'nao_gostei'
          WHEN 'gostei_muito' THEN 'gostei_muito'
          WHEN 'muito_bom' THEN 'muito_bom'
          ELSE 'gostei'
        END,
        CASE COALESCE(NULLIF(c.data->'reviews', 'null'::jsonb)->0->>'qualitativeScore', 'gostei')
          WHEN 'nao_gostei' THEN 1
          WHEN 'gostei' THEN 2
          WHEN 'gostei_muito' THEN 3
          ELSE 4
        END,
        LEFT(COALESCE(NULLIF(c.data->'reviews', 'null'::jsonb)->0->>'comment', ''), 200),
        'approved',
        COALESCE((NULLIF(c.data->'reviews', 'null'::jsonb)->0->>'verifiedSms')::boolean, FALSE),
        COALESCE((NULLIF(c.data->'reviews', 'null'::jsonb)->0->>'createdAt')::timestamptz, NOW())
      FROM companies c
      WHERE c.data->'reviews' IS NOT NULL
        AND jsonb_typeof(c.data->'reviews') = 'array'
        AND jsonb_array_length(c.data->'reviews') > 0
        AND NOT EXISTS (
          SELECT 1 FROM reviews r
          WHERE r.business_id = c.id
            AND r.author_phone_hash = 'legacy:' || c.id
        )
    $migration$;
  END IF;
END $$;
