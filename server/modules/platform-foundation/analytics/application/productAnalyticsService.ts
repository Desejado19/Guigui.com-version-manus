import type { ProductEventInput } from '../domain/productEvent';

export type ProductFunnelStage = {
  name: string;
  count: number;
};

export type ProductFunnel = {
  configured: boolean;
  days: number;
  stages: ProductFunnelStage[];
};

export interface ProductAnalyticsRepository {
  persistProductEvent(input: ProductEventInput): Promise<void>;
  getProductFunnel(days: number): Promise<ProductFunnel>;
}

const allowedProductEvents = new Set([
  'page_view',
  'search_submitted',
  'search_result_clicked',
  'checkout_started',
  'payment_completed',
  'payment_failed',
  'ticket_purchased',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createProductAnalyticsService(repository: ProductAnalyticsRepository) {
  return {
    async persistProductEvent(input: ProductEventInput): Promise<void> {
      if (!allowedProductEvents.has(input.eventName)) {
        throw new Error('Unsupported product event.');
      }

      const context: unknown = input.context ?? {};
      if (!isRecord(context) || Object.keys(context).length > 0) {
        throw new Error('Product event context is not approved.');
      }

      await repository.persistProductEvent({
        ...input,
        context,
      });
    },

    async getProductFunnel(days = 30): Promise<ProductFunnel> {
      if (!Number.isFinite(days)) {
        throw new RangeError('Product funnel days must be a finite number.');
      }
      const boundedDays = Math.min(Math.max(Math.trunc(days), 1), 365);
      return repository.getProductFunnel(boundedDays);
    },
  };
}
