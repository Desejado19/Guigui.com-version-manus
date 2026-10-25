import { describe, expect, it, vi } from 'vitest';
import {
  createProductAnalyticsService,
  type ProductAnalyticsRepository,
} from '../../server/modules/platform-foundation/analytics/application/productAnalyticsService';
import type { ProductEventName } from '../../server/modules/platform-foundation/analytics/domain/productEvent';

function createRepository(
  overrides: Partial<ProductAnalyticsRepository> = {},
): ProductAnalyticsRepository {
  return {
    persistProductEvent: vi.fn().mockResolvedValue(undefined),
    getProductFunnel: vi.fn().mockResolvedValue({ configured: true, days: 30, stages: [] }),
    ...overrides,
  };
}

describe('platform-foundation product analytics', () => {
  it('rejects unknown product event names', async () => {
    const repository = createRepository();
    const service = createProductAnalyticsService(repository);

    await expect(service.persistProductEvent({
      eventName: 'account_exported' as ProductEventName,
      source: 'web',
    })).rejects.toThrow('Unsupported product event.');

    expect(repository.persistProductEvent).not.toHaveBeenCalled();
  });

  it('rejects context keys until an event-specific allowlist exists', async () => {
    const repository = createRepository();
    const service = createProductAnalyticsService(repository);

    await expect(service.persistProductEvent({
      eventName: 'page_view',
      source: 'web',
      context: { email: 'private@example.test' },
    })).rejects.toThrow('Product event context is not approved.');

    expect(repository.persistProductEvent).not.toHaveBeenCalled();
  });

  it('persists an empty context when none is supplied', async () => {
    const repository = createRepository();
    const service = createProductAnalyticsService(repository);

    await service.persistProductEvent({
      eventName: 'page_view',
      source: 'web',
      appVersion: '2.1',
    });

    expect(repository.persistProductEvent).toHaveBeenCalledWith({
      eventName: 'page_view',
      source: 'web',
      appVersion: '2.1',
      context: {},
    });
  });

  it('keeps product funnel day limits and database state', async () => {
    const repository = createRepository();
    const service = createProductAnalyticsService(repository);

    await service.getProductFunnel(500);

    expect(repository.getProductFunnel).toHaveBeenCalledWith(365);
  });
});
