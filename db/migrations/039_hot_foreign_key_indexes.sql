-- Índices das chaves estrangeiras mais usadas nas consultas de leitura.
-- A auditoria encontrou FKs declaradas sem índice em `events`, `orders`,
-- `tickets` e `payment_transactions`; sem eles, a listagem de eventos de uma
-- empresa, os pedidos de um evento e os bilhetes de um pedido fazem varrimento
-- sequencial à medida que o volume cresce. Migração aditiva e idempotente: não
-- altera dados nem o esquema lógico.
CREATE INDEX IF NOT EXISTS idx_events_company_id ON events (company_id);
CREATE INDEX IF NOT EXISTS idx_orders_event_id ON orders (event_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_user_id ON orders (buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_order_id ON tickets (order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event_id ON tickets (event_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON payment_transactions (order_id);
