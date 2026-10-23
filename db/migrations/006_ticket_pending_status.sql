-- Regulamento de Bilhética v1.0 — Regra 4.7 (reserva temporária com prazo) e Regra 11 (estados do bilhete).
--
-- O estado 'pending' representa uma reserva de bilhete durante a confirmação do pagamento:
-- a quantidade fica reservada até ao fim do prazo e é libertada quando não existir
-- pagamento confirmado (Regra 4.7). O bilhete só passa a 'valid' após confirmação do pagamento.
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_status_check CHECK (status IN ('pending', 'valid', 'used', 'expired'));