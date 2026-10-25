import { readSnapshot, runImportFromCli, type ImportPool } from './importRunner';

type Ledger = { id: string; transactionId?: string; businessId?: string; userId?: string; productId: string; productCode: string; description: string; quantity: number; grossAmount: number; platformFee: number; netAmount: number; currency: string; status: string; metadata?: Record<string, unknown>; createdAt: string };
type Wallet = { postsExtraPurchased: number; promotionsExtraPurchased: number; postsExtraUsed: number; promotionsExtraUsed: number; updatedAt: string };
const ledger = readSnapshot<Ledger[]>('monetization-ledger.json');
const wallets = readSnapshot<Record<string, Wallet>>('monetization-wallets.json');

// Each record is one unit of work: a ledger entry or a business wallet.
type MonetizationRecord =
  | { kind: 'ledger'; entry: Ledger }
  | { kind: 'wallet'; businessId: string; wallet: Wallet };

const records: MonetizationRecord[] = [
  ...ledger.map((entry) => ({ kind: 'ledger' as const, entry })),
  ...Object.entries(wallets).map(([businessId, wallet]) => ({ kind: 'wallet' as const, businessId, wallet })),
];

async function importMonetization(record: MonetizationRecord, pool: ImportPool): Promise<boolean> {
  if (record.kind === 'ledger') {
    const entry = record.entry;
    const result = await pool.query(
      `INSERT INTO monetization_ledger
       (id,transaction_id,business_id,user_id,product_id,product_code,description,quantity,gross_amount_xof,platform_fee_xof,net_amount_xof,currency,status,metadata,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO NOTHING`,
      [entry.id, entry.transactionId || null, entry.businessId || null, entry.userId || null, entry.productId, entry.productCode, entry.description, entry.quantity, entry.grossAmount, entry.platformFee, entry.netAmount, entry.currency, entry.status, JSON.stringify(entry.metadata || {}), entry.createdAt],
    );
    return result.rowCount === 1;
  }
  const { businessId, wallet } = record;
  const result = await pool.query(
    `INSERT INTO monetization_wallets (business_id,posts_extra_purchased,promotions_extra_purchased,posts_extra_used,promotions_extra_used,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (business_id) DO NOTHING`,
    [businessId, wallet.postsExtraPurchased, wallet.promotionsExtraPurchased, wallet.postsExtraUsed, wallet.promotionsExtraUsed, wallet.updatedAt],
  );
  return result.rowCount === 1;
}

await runImportFromCli({
  label: 'monetização',
  records,
  recordKey: (record) => record.kind === 'ledger' ? `ledger:${record.entry.id}` : `wallet:${record.businessId}`,
  validateRecord: (record) => record.kind === 'ledger'
    ? Boolean(
      record.entry
      && typeof record.entry.id === 'string'
      && record.entry.id.trim()
      && typeof record.entry.productId === 'string'
      && Number.isFinite(record.entry.quantity)
      && Number.isFinite(record.entry.grossAmount)
      && Number.isFinite(record.entry.platformFee)
      && Number.isFinite(record.entry.netAmount)
      && typeof record.entry.createdAt === 'string',
    )
    : Boolean(
      record.businessId.trim()
      && record.wallet
      && Number.isFinite(record.wallet.postsExtraPurchased)
      && Number.isFinite(record.wallet.promotionsExtraPurchased)
      && Number.isFinite(record.wallet.postsExtraUsed)
      && Number.isFinite(record.wallet.promotionsExtraUsed)
      && typeof record.wallet.updatedAt === 'string',
    ),
  hasConflict: async (record, pool) => {
    if (record.kind === 'ledger') {
      return (await pool.query(
        `SELECT 1 FROM monetization_ledger
         WHERE id = $1
            OR ($2 IS NOT NULL AND transaction_id = $2 AND product_code = $3)
         LIMIT 1`,
        [record.entry.id, record.entry.transactionId || null, record.entry.productCode],
      )).rows.length > 0;
    }
    return (await pool.query('SELECT 1 FROM monetization_wallets WHERE business_id = $1 LIMIT 1', [record.businessId])).rows.length > 0;
  },
  importRecord: (record, pool) => importMonetization(record, pool),
});
