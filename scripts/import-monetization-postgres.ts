import { readSnapshot, runImport, type ImportPool } from './importRunner';

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

async function importMonetization(record: MonetizationRecord, pool: ImportPool): Promise<void> {
  if (record.kind === 'ledger') {
    const entry = record.entry;
    await pool.query(
      `INSERT INTO monetization_ledger
       (id,transaction_id,business_id,user_id,product_id,product_code,description,quantity,gross_amount_xof,platform_fee_xof,net_amount_xof,currency,status,metadata,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,metadata=EXCLUDED.metadata`,
      [entry.id, entry.transactionId || null, entry.businessId || null, entry.userId || null, entry.productId, entry.productCode, entry.description, entry.quantity, entry.grossAmount, entry.platformFee, entry.netAmount, entry.currency, entry.status, JSON.stringify(entry.metadata || {}), entry.createdAt],
    );
    return;
  }
  const { businessId, wallet } = record;
  await pool.query(
    `INSERT INTO monetization_wallets (business_id,posts_extra_purchased,promotions_extra_purchased,posts_extra_used,promotions_extra_used,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (business_id) DO UPDATE SET posts_extra_purchased=EXCLUDED.posts_extra_purchased,promotions_extra_purchased=EXCLUDED.promotions_extra_purchased,posts_extra_used=EXCLUDED.posts_extra_used,promotions_extra_used=EXCLUDED.promotions_extra_used,updated_at=EXCLUDED.updated_at`,
    [businessId, wallet.postsExtraPurchased, wallet.promotionsExtraPurchased, wallet.postsExtraUsed, wallet.promotionsExtraUsed, wallet.updatedAt],
  );
}

await runImport({
  label: 'monetização',
  records,
  importRecord: (record, pool) => importMonetization(record, pool),
  summary: () => `postgres-monetization-import: ${ledger.length} ledger entry(s), ${Object.keys(wallets).length} wallet(s)`,
});
