import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverExpressRoutes } from '../../scripts/qa/discover-routes';
import { validateRouteInventory } from '../../scripts/qa/validate-route-inventory';

const tempDirectories: string[] = [];

async function createRouteFixture(serverSource: string, routerSource?: string) {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'guigui-qa-routes-'));
  tempDirectories.push(rootDir);
  await mkdir(path.join(rootDir, 'server'), { recursive: true });
  await writeFile(path.join(rootDir, 'server.ts'), serverSource);
  if (routerSource) {
    await writeFile(path.join(rootDir, 'server', 'categoryRoutes.ts'), routerSource);
  }
  return rootDir;
}

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

const route = {
  method: 'GET',
  path: '/api/health',
  source: 'server.ts:2',
  authentication: 'public',
  preconditions: [],
  scenario: 'Returns the health status',
};

const collection = (items: unknown[] = []) => ({
  item: items,
  variable: [
    { key: 'qaBaseUrl', value: 'http://127.0.0.1:4313' },
    { key: 'syntheticId', value: 'qa-nonexistent-record' },
  ],
  protocolProfileBehavior: { followRedirects: false },
});
const request = (method: string, url: string) => ({ request: { method, url: { raw: url } } });

describe('validateRouteInventory', () => {
  it('rejects duplicate method and path entries', () => {
    const result = validateRouteInventory([route, route], collection(), {
      routes: [{ method: 'GET', path: '/api/health', sources: ['server.ts:2'], aliases: [] }],
      unresolved: [],
    });

    expect(result.errors.join('\n')).toMatch(/duplicate/i);
  });

  it('rejects an entry without a scenario or exclusion reason', () => {
    const { scenario: _scenario, ...unclassified } = route;
    const result = validateRouteInventory([unclassified], collection(), {
      routes: [{ method: 'GET', path: '/api/health', sources: ['server.ts:2'], aliases: [] }],
      unresolved: [],
    });

    expect(result.errors.join('\n')).toMatch(/scenario|exclusion/i);
  });

  it('rejects discovered source routes that are absent from the inventory', () => {
    const result = validateRouteInventory([], collection(), {
      routes: [{ method: 'GET', path: '/api/health', sources: ['server.ts:2'], aliases: [] }],
      unresolved: [],
    });

    expect(result.errors.join('\n')).toMatch(/missing from inventory/i);
  });

  it('rejects inventory entries that do not identify the source registration', () => {
    const result = validateRouteInventory([{ ...route, source: 'server.ts:999' }], collection([
      request('GET', '{{qaBaseUrl}}/api/health'),
    ]), {
      routes: [{ method: 'GET', path: '/api/health', sources: ['server.ts:2'], aliases: [] }],
      unresolved: [],
    });

    expect(result.errors.join('\n')).toMatch(/source registration/i);
  });

  it('rejects source discovery containing unresolved dynamic registrations', () => {
    const result = validateRouteInventory([route], collection(), {
      routes: [{ method: 'GET', path: '/api/health', sources: ['server.ts:2'], aliases: [] }],
      unresolved: ['server.ts:3: computed app route method'],
    });

    expect(result.errors.join('\n')).toMatch(/unresolved/i);
  });

  it('rejects covered routes that have no collection request', () => {
    const result = validateRouteInventory([route], collection(), {
      routes: [{ method: 'GET', path: '/api/health', sources: ['server.ts:2'], aliases: [] }],
      unresolved: [],
    });

    expect(result.errors.join('\n')).toMatch(/collection request/i);
  });

  it('requires collection requests for every discovered compatibility alias', () => {
    const result = validateRouteInventory([route], collection([
      request('GET', '{{qaBaseUrl}}/api/health'),
    ]), {
      routes: [{
        method: 'GET',
        path: '/api/health',
        sources: ['server.ts:2'],
        aliases: ['/api/v1/health'],
      }],
      unresolved: [],
    });

    expect(result.errors.join('\n')).toMatch(/compatibility alias/i);
  });

  it('accepts an explicitly excluded route without a collection request', () => {
    const { scenario: _scenario, ...excludedRoute } = route;
    const result = validateRouteInventory([{
      ...excludedRoute,
      exclusionReason: 'A static frontend route is covered by browser tests.',
    }], collection(), {
      routes: [{ method: 'GET', path: '/api/health', sources: ['server.ts:2'], aliases: [] }],
      unresolved: [],
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('rejects collection requests for routes marked excluded', () => {
    const { scenario: _scenario, ...excludedRoute } = route;
    const result = validateRouteInventory([{
      ...excludedRoute,
      exclusionReason: 'The route changes persistent state.',
    }], collection([request('GET', '{{qaBaseUrl}}/api/health')]), {
      routes: [{ method: 'GET', path: '/api/health', sources: ['server.ts:2'], aliases: [] }],
      unresolved: [],
    });

    expect(result.errors.join('\n')).toMatch(/excluded/i);
  });

  it('rejects collection requests that do not map to any source route', () => {
    const result = validateRouteInventory([route], collection([
      request('GET', '{{qaBaseUrl}}/api/not-registered'),
      request('GET', '{{qaBaseUrl}}/api/health'),
    ]), {
      routes: [{ method: 'GET', path: '/api/health', sources: ['server.ts:2'], aliases: [] }],
      unresolved: [],
    });

    expect(result.errors.join('\n')).toMatch(/not represented in the inventory/i);
  });

  it('rejects a collection base URL that could send requests off localhost', () => {
    const unsafeCollection = {
      ...collection([request('GET', '{{qaBaseUrl}}/api/health')]),
      variable: [{ key: 'qaBaseUrl', value: 'https://example.com' }],
    };
    const result = validateRouteInventory([route], unsafeCollection, {
      routes: [{ method: 'GET', path: '/api/health', sources: ['server.ts:2'], aliases: [] }],
      unresolved: [],
    });

    expect(result.errors.join('\n')).toMatch(/loopback/i);
  });

  it('accepts an explicitly excluded frontend wildcard route', () => {
    const wildcardRoute = {
      method: 'GET',
      path: '*',
      source: 'server.ts:5',
      authentication: 'public',
      preconditions: [],
      exclusionReason: 'Frontend fallback is covered by the browser suite.',
    };
    const result = validateRouteInventory([wildcardRoute], collection(), {
      routes: [{ method: 'GET', path: '*', sources: ['server.ts:5'], aliases: [] }],
      unresolved: [],
    });

    expect(result).toEqual({ valid: true, errors: [] });
  });
});

describe('discoverExpressRoutes', () => {
  it('reports a missing Express entrypoint instead of accepting an empty source map', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'guigui-qa-routes-'));
    tempDirectories.push(rootDir);
    await mkdir(path.join(rootDir, 'server'), { recursive: true });

    const discovery = discoverExpressRoutes(rootDir);

    expect(discovery.unresolved).toEqual(['server.ts:1: missing Express server entrypoint']);
  });

  it('discovers direct routes, mounted router paths, and the /api/v1 compatibility alias', async () => {
    const rootDir = await createRouteFixture(
      [
        'import { createCategoryRouter } from "./server/categoryRoutes";',
        'const app = express();',
        'app.get("/api/health", handler);',
        'app.use("/api/categories", createCategoryRouter());',
        'app.use((req, res, next) => {',
        '  if (req.url.startsWith("/api/v1/")) req.url = req.url.replace("/api/v1", "/api");',
        '  next();',
        '});',
      ].join('\n'),
      [
        'export function createCategoryRouter() {',
        '  const router = Router();',
        '  router.get("/", handler);',
        '  return router;',
        '}',
      ].join('\n'),
    );

    const discovery = discoverExpressRoutes(rootDir);

    expect(discovery.unresolved).toEqual([]);
    expect(discovery.routes).toContainEqual({
      method: 'GET',
      path: '/api/health',
      sources: ['server.ts:3'],
      aliases: ['/api/v1/health'],
    });
    expect(discovery.routes).toContainEqual({
      method: 'GET',
      path: '/api/categories',
      sources: ['server/categoryRoutes.ts:3'],
      aliases: ['/api/v1/categories'],
    });
  });

  it('reports computed route methods instead of silently omitting them', async () => {
    const rootDir = await createRouteFixture([
      'const app = express();',
      'const method = resolveMethod();',
      'app[method]("/api/dynamic", handler);',
    ].join('\n'));

    const discovery = discoverExpressRoutes(rootDir);

    expect(discovery.unresolved).toEqual(['server.ts:3: computed app route method']);
  });

  it('reports computed route paths instead of aborting source discovery', async () => {
    const rootDir = await createRouteFixture([
      'const app = express();',
      'const routePath = getRoutePath();',
      'app.get(routePath, handler);',
    ].join('\n'));

    const discovery = discoverExpressRoutes(rootDir);

    expect(discovery.unresolved).toEqual(['server.ts:3: computed app route path']);
  });

  it('reports app.all registrations that need explicit method expansion', async () => {
    const rootDir = await createRouteFixture([
      'const app = express();',
      'app.all("/api/universal", handler);',
    ].join('\n'));

    const discovery = discoverExpressRoutes(rootDir);

    expect(discovery.unresolved).toEqual(['server.ts:2: app.all requires explicit method expansion']);
  });
});
