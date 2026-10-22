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
      response.json(await getPlatformHealth(dependencies));
    } catch (error) {
      next(error);
    }
  };
}
