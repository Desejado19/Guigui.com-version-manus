import type { RequestHandler } from 'express';
import {
  getPlatformHealth,
  type HealthDependencies,
} from '../application/getPlatformHealth';

export function createHealthHandler(
  dependencies: HealthDependencies,
  detailed: boolean | ((request: Parameters<RequestHandler>[0]) => boolean | Promise<boolean>) = true,
): RequestHandler {
  return async (request, response, next) => {
    try {
      const isDetailed = typeof detailed === 'function' ? await detailed(request) : detailed;
      response.json(await getPlatformHealth(dependencies, isDetailed));
    } catch (error) {
      next(error);
    }
  };
}
