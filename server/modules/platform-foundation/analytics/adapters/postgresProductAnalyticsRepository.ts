import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type {
  ProductAnalyticsRepository,
  ProductFunnel,
  ProductFunnelStage,
} from '../application/productAnalyticsService';
import type { ProductEventInput } from '../domain/productEvent';

type ProductAnalyticsQueryPort = Pick<Pool, 'query'>;

type ProductFunnelRow = {
  name: string;
  count: number;
};

function toProductFunnelStage(row: ProductFunnelRow): ProductFunnelStage {
  if (typeof row.name !== 'string' || typeof row.count !== 'number') {
    throw new Error('Invalid PostgreSQL product funnel result.');
  }
  return { name: row.name, count: row.count };
}

export function createPostgresProductAnalyticsRepository(
  queryPort: ProductAnalyticsQueryPort | null,
): ProductAnalyticsRepository {
  return {
    async persistProductEvent(input: ProductEventInput): Promise<void> {
      if (!queryPort) return;
      await queryPort.query(
        `INSERT INTO product_events (id,event_name,source,app_version,user_id,session_id,context)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          `pe-${randomUUID()}`,
          input.eventName,
          input.source.slice(0, 120),
          (input.appVersion || '1').slice(0, 40),
          input.userId || null,
          input.sessionId?.slice(0, 120) || null,
          JSON.stringify(input.context ?? {}),
        ],
      );
    },

    async getProductFunnel(days: number): Promise<ProductFunnel> {
      if (!queryPort) return { configured: false, days, stages: [] };
      const result = await queryPort.query<ProductFunnelRow>(
        `SELECT event_name AS name, COUNT(*)::int AS count
         FROM product_events
         WHERE occurred_at >= NOW() - ($1::int * INTERVAL '1 day')
         GROUP BY event_name ORDER BY count DESC`,
        [days],
      );
      return {
        configured: true,
        days,
        stages: result.rows.map(toProductFunnelStage),
      };
    },
  };
}
