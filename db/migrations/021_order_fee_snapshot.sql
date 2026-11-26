-- Fotografia da política de taxa de bilheteira aplicada no momento da compra.
-- Cada ordem passa a guardar a percentagem, a taxa fixa e os valores calculados
-- em vigor nessa altura, em vez de depender da política atual.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fee_policy JSONB;

COMMENT ON COLUMN orders.fee_policy IS 'Política e valores de taxa de bilheteira aplicados quando a ordem foi criada.';
