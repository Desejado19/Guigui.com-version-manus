import { databasePool } from './db';
import { createProductAnalyticsService } from './modules/platform-foundation/analytics/application/productAnalyticsService';
import { createPostgresProductAnalyticsRepository } from './modules/platform-foundation/analytics/adapters/postgresProductAnalyticsRepository';

const productAnalytics = createProductAnalyticsService(
  createPostgresProductAnalyticsRepository(databasePool),
);

export const persistProductEvent = productAnalytics.persistProductEvent;
export const getProductFunnel = productAnalytics.getProductFunnel;
