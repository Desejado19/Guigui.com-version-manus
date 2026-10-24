import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverExpressRoutes, type DiscoveredRoute, type RouteDiscoveryResult } from './discover-routes';

interface RouteInventoryEntry {
  method: string;
  path: string;
  source: string;
  authentication: string;
  preconditions: string[];
  scenario?: string;
  exclusionReason?: string;
}

interface CollectionRequest {
  name?: string;
  request?: {
    method?: string;
    url?: string | { raw?: string };
  };
  item?: CollectionRequest[];
}

export interface RouteCoverageResult {
  valid: boolean;
  errors: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeMethod(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : undefined;
}

function normalizePath(value: unknown): string | undefined {
  if (value === '*') return '*';
  return typeof value === 'string' && value.startsWith('/') ? value.replace(/\/+$/, '') || '/' : undefined;
}

function routeKey(method: string, routePath: string): string {
  return `${method.toUpperCase()} ${routePath}`;
}

function routePathMatches(routePath: string, requestPath: string): boolean {
  if (routePath === '*' || routePath === '/*') return true;
  const expression = routePath
    .split('/')
    .map((part) => part.startsWith(':') || part === '*' ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('/');
  return new RegExp(`^${expression}/?$`).test(requestPath);
}

function collectionRequests(collection: unknown): Array<{ method: string; url: string; name: string }> {
  if (!isRecord(collection) || !Array.isArray(collection.item)) return [];
  const requests: Array<{ method: string; url: string; name: string }> = [];

  function visit(items: unknown[]) {
    for (const item of items) {
      if (!isRecord(item)) continue;
      if (isRecord(item.request)) {
        const method = normalizeMethod(item.request.method);
        const rawUrl = typeof item.request.url === 'string'
          ? item.request.url
          : isRecord(item.request.url) && typeof item.request.url.raw === 'string'
            ? item.request.url.raw
            : undefined;
        if (method && rawUrl) {
          requests.push({ method, url: rawUrl, name: typeof item.name === 'string' ? item.name : '(unnamed request)' });
        }
      }
      if (Array.isArray(item.item)) visit(item.item);
    }
  }

  visit(collection.item);
  return requests;
}

function parseLocalRequestPath(rawUrl: string): string | undefined {
  const prefix = '{{qaBaseUrl}}';
  if (!rawUrl.startsWith(prefix)) return undefined;
  const resolved = rawUrl.replace(prefix, 'http://127.0.0.1:4313')
    .replace(/\{\{[^}]+\}\}/g, 'synthetic-fixture');
  try {
    const url = new URL(resolved);
    if (url.origin !== 'http://127.0.0.1:4313') return undefined;
    return url.pathname.replace(/\/+$/, '') || '/';
  } catch {
    return undefined;
  }
}

function entryMatchesRoute(entry: RouteInventoryEntry, route: DiscoveredRoute): boolean {
  return entry.method.toUpperCase() === route.method
    && normalizePath(entry.path) === route.path;
}

export function validateRouteInventory(
  inventory: unknown,
  collection: unknown,
  discovery: RouteDiscoveryResult,
): RouteCoverageResult {
  const errors: string[] = [];
  if (!Array.isArray(inventory)) {
    return { valid: false, errors: ['Route inventory must be an array.'] };
  }

  const variables = isRecord(collection) && Array.isArray(collection.variable)
    ? collection.variable
    : [];
  const variableValues = new Map<string, unknown>();
  for (const candidate of variables) {
    if (!isRecord(candidate) || typeof candidate.key !== 'string') {
      errors.push('Collection variables must have valid names and values.');
      continue;
    }
    if (!['qaBaseUrl', 'syntheticId'].includes(candidate.key)) {
      errors.push(`Collection variable is not allowed: ${candidate.key}.`);
      continue;
    }
    if (variableValues.has(candidate.key)) {
      errors.push(`Collection variable is duplicated: ${candidate.key}.`);
      continue;
    }
    variableValues.set(candidate.key, candidate.value);
  }
  if (variableValues.get('qaBaseUrl') !== 'http://127.0.0.1:4313') {
    errors.push('Collection qaBaseUrl must target the approved 127.0.0.1 loopback host and port 4313.');
  }
  const syntheticId = variableValues.get('syntheticId');
  if (typeof syntheticId !== 'string' || !syntheticId.startsWith('qa-')) {
    errors.push('Collection syntheticId must use the qa- synthetic fixture prefix.');
  }
  if (!isRecord(collection)
    || !isRecord(collection.protocolProfileBehavior)
    || collection.protocolProfileBehavior.followRedirects !== false) {
    errors.push('Collection redirects must be disabled to keep requests on the local QA target.');
  }

  errors.push(...discovery.unresolved.map((registration) => `Unresolved source registration: ${registration}`));
  const entries: RouteInventoryEntry[] = [];
  const seen = new Set<string>();
  for (const [index, candidate] of inventory.entries()) {
    if (!isRecord(candidate)) {
      errors.push(`Inventory entry ${index + 1} must be an object.`);
      continue;
    }
    const method = normalizeMethod(candidate.method);
    const routePath = normalizePath(candidate.path);
    const source = typeof candidate.source === 'string' ? candidate.source.trim() : '';
    const authentication = typeof candidate.authentication === 'string' ? candidate.authentication.trim() : '';
    const preconditions = Array.isArray(candidate.preconditions)
      && candidate.preconditions.every((value) => typeof value === 'string')
      ? candidate.preconditions as string[]
      : undefined;
    if (!method || !routePath || !source || !authentication || !preconditions) {
      errors.push(`Inventory entry ${index + 1} is missing a valid method, path, source, authentication, or preconditions list.`);
      continue;
    }

    const scenario = typeof candidate.scenario === 'string' ? candidate.scenario.trim() : '';
    const exclusionReason = typeof candidate.exclusionReason === 'string' ? candidate.exclusionReason.trim() : '';
    if (Boolean(scenario) === Boolean(exclusionReason)) {
      errors.push(`${method} ${routePath} must have exactly one non-empty scenario or exclusion reason.`);
    }

    const entry: RouteInventoryEntry = {
      method,
      path: routePath,
      source,
      authentication,
      preconditions,
      ...(scenario ? { scenario } : {}),
      ...(exclusionReason ? { exclusionReason } : {}),
    };
    const key = routeKey(method, routePath);
    if (seen.has(key)) errors.push(`Duplicate inventory route: ${key}.`);
    seen.add(key);
    entries.push(entry);

    const discovered = discovery.routes.find((route) => entryMatchesRoute(entry, route));
    if (!discovered) {
      errors.push(`Inventory route is missing from source discovery: ${key}.`);
    } else {
      const sourceLocations = source.split(/[,;|]/).map((location) => location.trim());
      if (discovered.sources.some((location) => !sourceLocations.includes(location))) {
        errors.push(`Inventory source does not identify every source registration for ${key}.`);
      }
    }
  }

  for (const route of discovery.routes) {
    if (!entries.some((entry) => entryMatchesRoute(entry, route))) {
      errors.push(`Discovered route is missing from inventory: ${routeKey(route.method, route.path)}.`);
    }
  }

  const requests = collectionRequests(collection);
  const parsedRequests = requests.map((request) => ({
    ...request,
    path: parseLocalRequestPath(request.url),
  }));
  for (const request of parsedRequests) {
    if (!request.path) {
      errors.push(`Collection request "${request.name}" must use the local {{qaBaseUrl}} target.`);
      continue;
    }
    const matchingEntry = entries.find((entry) => {
      if (entry.method !== request.method || entry.path === '*') return false;
      const discovered = discovery.routes.find((route) => entryMatchesRoute(entry, route));
      return discovered !== undefined
        && [discovered.path, ...discovered.aliases].some((routePath) => routePathMatches(routePath, request.path!));
    });
    if (!matchingEntry) {
      errors.push(`Collection request is not represented in the inventory: ${request.method} ${request.path}.`);
    } else if (matchingEntry.exclusionReason) {
      errors.push(`Excluded route has a collection request: ${request.method} ${request.path}.`);
    }
  }

  for (const entry of entries) {
    const discovered = discovery.routes.find((route) => entryMatchesRoute(entry, route));
    if (!discovered || entry.exclusionReason) continue;
    const requiredPaths = [discovered.path, ...discovered.aliases];
    for (const [index, requiredPath] of requiredPaths.entries()) {
      const requestExists = parsedRequests.some((request) => request.method === entry.method
        && request.path !== undefined
        && routePathMatches(requiredPath, request.path));
      if (!requestExists && index === 0) {
        errors.push(`Covered route has no collection request: ${routeKey(entry.method, entry.path)}.`);
      } else if (!requestExists) {
        errors.push(`Compatibility alias has no collection request: ${entry.method} ${requiredPath}.`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function main() {
  const rootDir = process.cwd();
  const inventory = JSON.parse(readFileSync(path.join(rootDir, 'tests/api/route-inventory.json'), 'utf8')) as unknown;
  const collection = JSON.parse(readFileSync(path.join(rootDir, 'tests/api/guigui-local-qa.postman_collection.json'), 'utf8')) as unknown;
  const result = validateRouteInventory(inventory, collection, discoverExpressRoutes(rootDir));
  if (!result.valid) {
    console.error(result.errors.join('\n'));
    process.exitCode = 1;
    return;
  }
  const routeCount = Array.isArray(inventory) ? inventory.length : 0;
  console.log(`API route inventory is complete (${routeCount} routes; ${collectionRequests(collection).length} Newman requests).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
