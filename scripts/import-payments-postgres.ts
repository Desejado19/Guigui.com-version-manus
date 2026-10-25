import { readSnapshot, runImportFromCli, type ImportPool } from './importRunner';

type LegacyPayment = {
  id: string;
  provider: string;
  providerRef?: string;
  amountXOF: number;
  status: string;
  payerName?: string;
  payerPhone?: string;
  useCase?: string;
  providerMode?: string;
  createdAt?: string;
  confirmedAt?: string;
};

const statusMap: Record<string, string> = {
  confirmed_api: 'paid',
  confirmed_manual: 'authorized',
  pending_provider: 'pending',
  pending_manual_confirmation: 'pending',
  reconciled: 'paid',
  refunded: 'refunded',
};

const payments = readSnapshot<LegacyPayment[]>('payments.json');

async function importPayment(payment: LegacyPayment, pool: ImportPool): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO payment_transactions
     (id,provider,provider_reference,status,gross_amount_xof,net_amount_xof,payer_name,payer_phone,use_case,provider_mode,confirmed_at,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11,$11)
     ON CONFLICT (id) DO NOTHING`,
    [payment.id, payment.provider, payment.providerRef || null, statusMap[payment.status] || 'pending', payment.amountXOF, payment.payerName || null, payment.payerPhone || null, payment.useCase || null, payment.providerMode || null, payment.confirmedAt || null, payment.createdAt || new Date().toISOString()],
  );
  return result.rowCount === 1;
}

await runImportFromCli({
  label: 'pagamentos',
  records: payments,
  recordKey: (payment) => payment.id,
  validateRecord: (payment) => Boolean(
    payment
    && typeof payment.id === 'string'
    && payment.id.trim()
    && typeof payment.provider === 'string'
    && Number.isFinite(payment.amountXOF)
    && Object.prototype.hasOwnProperty.call(statusMap, payment.status),
  ),
  hasConflict: async (payment, pool) => (
    await pool.query(
      `SELECT 1 FROM payment_transactions
       WHERE id = $1
          OR ($2 IS NOT NULL AND provider = $3 AND provider_reference = $2)
       LIMIT 1`,
      [payment.id, payment.providerRef || null, payment.provider],
    )
  ).rows.length > 0,
  importRecord: (payment, pool) => importPayment(payment, pool),
});
