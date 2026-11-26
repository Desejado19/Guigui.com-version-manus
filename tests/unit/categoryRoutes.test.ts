import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express, { type Router } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { createCategoryRouter } from '../../server/categoryRoutes';

async function withServer<T>(
  route: Router,
  action: (baseUrl: string) => Promise<T>,
): Promise<T> {
  const app = express();
  app.use('/api/categories', route);
  const server: Server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Category route test server did not bind to TCP.');

  try {
    return await action(`http://127.0.0.1:${(address as AddressInfo).port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

describe('category catalog route', () => {
  it('returns the category catalog envelope without authentication', async () => {
    const catalog = {
      groups: [{ id: 'restauracao', name: 'Restauração', description: 'Grupo' }],
      categories: [],
    };
    const route = createCategoryRouter({
      listCatalog: async () => catalog,
      logger: { error: vi.fn() },
    });

    await withServer(route, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/categories`);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(catalog);
    });
  });

  it('returns CATEGORY_CATALOG_LOAD_FAILED when the category reader rejects', async () => {
    const failure = new Error('category query failed');
    const logger = { error: vi.fn() };
    const route = createCategoryRouter({
      listCatalog: async () => {
        throw failure;
      },
      logger,
    });

    await withServer(route, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/categories`);
      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({
        error: expect.any(String),
        code: 'CATEGORY_CATALOG_LOAD_FAILED',
      });
    });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('category'), failure);
  });
});
