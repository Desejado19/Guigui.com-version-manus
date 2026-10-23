import { readSnapshot, runImport, type ImportPool } from './importRunner';

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

async function importPayment(payment: LegacyPayment, pool: ImportPool): Promise<void> {
  await pool.query(
    `INSERT INTO payment_transactions
     (id,provider,provider_reference,status,gross_amount_xof,net_amount_xof,payer_name,payer_phone,use_case,provider_mode,confirmed_at,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11,$11)
     ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, provider_reference=EXCLUDED.provider_reference,
     payer_name=EXCLUDED.payer_name, payer_phone=EXCLUDED.payer_phone, use_case=EXCLUDED.use_case,
     provider_mode=EXCLUDED.provider_mode, confirmed_at=EXCLUDED.confirmed_at, updated_at=NOW()`,
    [payment.id, payment.provider, payment.providerRef || null, statusMap[payment.status] || 'pending', payment.amountXOF, payment.payerName || null, payment.payerPhone || null, payment.useCase || null, payment.providerMode || null, payment.confirmedAt || null, payment.createdAt || new Date().toISOString()],
  );
}

await runImport({
  label: 'pagamentos',
  records: payments,
  importRecord: (payment, pool) => importPayment(payment, pool),
  summary: (_pool, records) => `postgres-payments-import: ${records.length} pagamento(s) importado(s)`,
});
