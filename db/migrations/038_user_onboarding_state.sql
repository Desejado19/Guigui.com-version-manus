-- Guia de boas-vindas: o estado (apresentado, concluído ou saltado) passa a
-- viver na conta e não apenas no browser. Assim o guia abre uma única vez por
-- utilizador, mesmo que inicie sessão noutro browser ou dispositivo.
-- Migração aditiva: contas existentes começam com o objeto vazio.
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_state JSONB NOT NULL DEFAULT '{}'::jsonb;
