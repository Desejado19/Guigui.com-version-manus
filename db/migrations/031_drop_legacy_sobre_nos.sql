-- Remoção do módulo legado "Sobre Nós" (blob JSON), substituído pelo módulo
-- institucional normalizado. Só remove as tabelas se estiverem vazias — se
-- contiverem dados, ficam intactas e o operador deve migrá-las primeiro.

DO $$
BEGIN
  IF to_regclass('public.sobre_nos_history') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM sobre_nos_history) THEN
    DROP TABLE sobre_nos_history;
  END IF;

  IF to_regclass('public.sobre_nos') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM sobre_nos) THEN
    DROP TABLE sobre_nos;
  END IF;
END $$;
