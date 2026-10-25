import type { RequestHandler } from 'express';
import {
  getPlatformHealth,
  type HealthDependencies,
} from '../application/getPlatformHealth';

export function createHealthHandler(
  dependencies: HealthDependencies,
): RequestHandler {
  return async (_request, response, next) => {
    try {
      const health = await getPlatformHealth(dependencies);
      response.status(health.status === 'degraded' ? 503 : 200).json(health);
    } catch (error) {
      next(error);
    }
  };
}
