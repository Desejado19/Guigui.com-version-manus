import { databasePool } from './db';

type LedgerEntry = {
  id: string;
  transactionId?: string;
  businessId?: string;
  userId?: string;
  productId: string;
  productCode: string;
  description: string;
  quantity: number;
  grossAmount: number;
  platformFee: number;
  netAmount: number;
  currency: string;
  status: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

type Wallet = {
  postsExtraPurchased: number;
  promotionsExtraPurchased: number;
  postsExtraUsed: number;
  promotionsExtraUsed: number;
  updatedAt: string;
};

export async function persistPostgresMonetization(entry: LedgerEntry, wallet?: Wallet): Promise<void> {
  if (!databasePool) return;
  const client = await databasePool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO monetization_ledger
       (id,transaction_id,business_id,user_id,product_id,product_code,description,quantity,gross_amount_xof,platform_fee_xof,net_amount_xof,currency,status,metadata,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,metadata=EXCLUDED.metadata`,
      [entry.id, entry.transactionId || null, entry.businessId || null, entry.userId || null, entry.productId, entry.productCode, entry.description, entry.quantity, entry.grossAmount, entry.platformFee, entry.netAmount, entry.currency, entry.status, JSON.stringify(entry.metadata || {}), entry.createdAt],
    );
    if (entry.businessId && wallet) {
      await client.query(
        `INSERT INTO monetization_wallets
         (business_id,posts_extra_purchased,promotions_extra_purchased,posts_extra_used,promotions_extra_used,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (business_id) DO UPDATE SET posts_extra_purchased=EXCLUDED.posts_extra_purchased,
         promotions_extra_purchased=EXCLUDED.promotions_extra_purchased,posts_extra_used=EXCLUDED.posts_extra_used,
         promotions_extra_used=EXCLUDED.promotions_extra_used,updated_at=EXCLUDED.updated_at`,
        [entry.businessId, wallet.postsExtraPurchased, wallet.promotionsExtraPurchased, wallet.postsExtraUsed, wallet.promotionsExtraUsed, wallet.updatedAt],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function markPostgresMonetizationRefunded(transactionId: string): Promise<void> {
  if (!databasePool) return;
  await databasePool.query(`UPDATE monetization_ledger SET status='refunded' WHERE transaction_id=$1 AND status='paid'`, [transactionId]);
}
