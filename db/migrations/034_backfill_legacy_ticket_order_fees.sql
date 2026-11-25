-- Repara pedidos de bilheteira pagos criados antes da fotografia de taxas
-- (021_order_fee_snapshot.sql). Esses pedidos têm receita bruta mas
-- fee_amount_xof = 0 e fee_policy IS NULL, pelo que a Comissão Guigui.com
-- aparecia a zero no centro de controlo do evento e no financeiro.
--
-- A reparação usa a política de taxas activa no momento da migração e grava a
-- respectiva fotografia na ordem. Pedidos que já tenham fee_policy (mesmo com
-- isenção explícita) não são alterados.
WITH active_policy AS (
  SELECT commission_percentage, fixed_fee_xof, currency, fee_payer, billing_model
    FROM ticket_fee_settings
   WHERE is_active = true
   ORDER BY version DESC
   LIMIT 1
), priced AS (
  SELECT
    o.id,
    o.gross_amount_xof::bigint AS gross,
    p.commission_percentage,
    p.fixed_fee_xof,
    p.currency,
    p.fee_payer,
    p.billing_model,
    CASE
      WHEN p.billing_model = 'fixed_only' THEN 0
      ELSE ROUND(o.gross_amount_xof * p.commission_percentage / 100.0)::bigint
    END AS percentage_fee,
    CASE
      WHEN p.billing_model = 'percentage_only' THEN 0
      ELSE p.fixed_fee_xof::bigint
    END AS fixed_fee
  FROM orders o
  CROSS JOIN active_policy p
  WHERE o.status = 'paid'
    AND o.fee_policy IS NULL
    AND o.fee_amount_xof = 0
    AND o.gross_amount_xof > 0
), calculated AS (
  SELECT
    id,
    gross,
    commission_percentage,
    fixed_fee_xof,
    currency,
    fee_payer,
    billing_model,
    percentage_fee,
    fixed_fee,
    (percentage_fee + fixed_fee) AS platform_fee,
    CASE
      WHEN fee_payer = 'buyer' THEN percentage_fee + fixed_fee
      WHEN fee_payer = 'split' THEN CEIL((percentage_fee + fixed_fee) / 2.0)::bigint
      ELSE 0
    END AS buyer_share,
    CASE
      WHEN fee_payer = 'organizer' THEN percentage_fee + fixed_fee
      WHEN fee_payer = 'split' THEN FLOOR((percentage_fee + fixed_fee) / 2.0)::bigint
      ELSE 0
    END AS organizer_share
  FROM priced
)
UPDATE orders o
   SET fee_amount_xof = c.platform_fee,
       net_amount_xof = c.gross - c.organizer_share,
       fee_policy = jsonb_build_object(
         'calculatedAt', to_jsonb(NOW()),
         'commissionPercentage', c.commission_percentage,
         'fixedFeeXOF', c.fixed_fee_xof,
         'billingModel', c.billing_model,
         'feePayer', c.fee_payer,
         'currency', c.currency,
         'grossTicketValueXOF', c.gross,
         'percentageFeeXOF', c.percentage_fee,
         'fixedFeeAmountXOF', c.fixed_fee,
         'platformFeeXOF', c.platform_fee,
         'buyerShareXOF', c.buyer_share,
         'organizerShareXOF', c.organizer_share,
         'buyerTotalXOF', c.gross + c.buyer_share,
         'organizerNetXOF', c.gross - c.organizer_share
       ),
       updated_at = NOW()
  FROM calculated c
 WHERE o.id = c.id;
