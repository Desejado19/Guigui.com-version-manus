import { readFileSync } from 'node:fs';

export type K6Options = {
  vus: number;
  duration: string;
  thresholds: Record<string, string[]>;
};

export type K6Endpoint = {
  method: string;
  path: string;
  readOnly: boolean;
};

export type K6Config = {
  options: K6Options;
  endpoints: K6Endpoint[];
};

const approvedThresholds: Record<string, string[]> = {
  http_req_duration: ['p(95)<2000'],
  http_req_failed: ['rate<0.01'],
  checks: ['rate==1'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseOptions(value: unknown): K6Options {
  if (!isRecord(value)
    || typeof value.vus !== 'number'
    || typeof value.duration !== 'string'
    || !isRecord(value.thresholds)) {
    throw new Error('k6 configuration options are invalid.');
  }

  const thresholds: Record<string, string[]> = {};
  for (const [name, candidates] of Object.entries(value.thresholds)) {
    if (!Array.isArray(candidates) || candidates.some((candidate) => typeof candidate !== 'string')) {
      throw new Error(`k6 threshold is invalid: ${name}.`);
    }
    thresholds[name] = candidates;
  }

  return { vus: value.vus, duration: value.duration, thresholds };
}

function parseEndpoints(value: unknown): K6Endpoint[] {
  if (!Array.isArray(value)) {
    throw new Error('k6 endpoint allowlist must be an array.');
  }

  return value.map((candidate, index) => {
    if (!isRecord(candidate)
      || typeof candidate.method !== 'string'
      || typeof candidate.path !== 'string'
      || typeof candidate.readOnly !== 'boolean') {
      throw new Error(`k6 endpoint ${index + 1} is invalid.`);
    }
    return {
      method: candidate.method,
      path: candidate.path,
      readOnly: candidate.readOnly,
    };
  });
}

export function loadK6Config(): K6Config {
  const rawConfig: unknown = JSON.parse(readFileSync(
    new URL('../../tests/load/k6-config.json', import.meta.url),
    'utf8',
  ));
  if (!isRecord(rawConfig)) {
    throw new Error('k6 configuration must be an object.');
  }

  return {
    options: parseOptions(rawConfig.options),
    endpoints: parseEndpoints(rawConfig.endpoints),
  };
}

function isApprovedTarget(target: string): boolean {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return false;
  }

  return url.protocol === 'http:'
    && url.hostname === '127.0.0.1'
    && url.port === '4313'
    && !url.username
    && !url.password
    && url.pathname === '/'
    && !url.search
    && !url.hash;
}

function thresholdsMatch(actual: Record<string, string[]>): boolean {
  const actualNames = Object.keys(actual).sort();
  const expectedNames = Object.keys(approvedThresholds).sort();
  return actualNames.length === expectedNames.length
    && actualNames.every((name, index) => name === expectedNames[index]
      && actual[name].length === approvedThresholds[name].length
      && actual[name].every((threshold, thresholdIndex) =>
        threshold === approvedThresholds[name][thresholdIndex]));
}

export function validateK6Config(
  target: string,
  options: K6Options,
  endpoints: K6Endpoint[],
): void {
  if (!isApprovedTarget(target)) {
    throw new Error('QA_BASE_URL must target the approved http://127.0.0.1:4313 loopback origin.');
  }
  if (options.vus !== 10) {
    throw new Error('k6 virtual users must be exactly 10.');
  }
  if (options.duration !== '60s') {
    throw new Error('k6 duration must be exactly 60 seconds.');
  }
  if (!thresholdsMatch(options.thresholds)) {
    throw new Error('k6 thresholds must match the approved latency, failure, and check limits.');
  }
  if (endpoints.length === 0) {
    throw new Error('k6 endpoint allowlist must not be empty.');
  }

  const rawInventory: unknown = JSON.parse(readFileSync(
    new URL('../../tests/api/route-inventory.json', import.meta.url),
    'utf8',
  ));
  if (!Array.isArray(rawInventory)) {
    throw new Error('API route inventory must be an array before k6 can run.');
  }

  const seen = new Set<string>();
  for (const endpoint of endpoints) {
    if (endpoint.method !== 'GET') {
      throw new Error('k6 endpoint methods must be GET only.');
    }
    if (!endpoint.readOnly) {
      throw new Error('Every k6 endpoint must be explicitly marked read-only.');
    }
    if (!endpoint.path.startsWith('/api/')
      || endpoint.path.includes(':')
      || endpoint.path.includes('*')
      || endpoint.path.includes('?')
      || endpoint.path.includes('#')) {
      throw new Error('k6 endpoints must use literal API paths from the safe route inventory.');
    }
    if (seen.has(endpoint.path)) {
      throw new Error(`k6 endpoint is duplicated: ${endpoint.path}.`);
    }
    seen.add(endpoint.path);

    const safeRouteExists = rawInventory.some((candidate) =>
      isRecord(candidate)
      && candidate.method === 'GET'
      && candidate.path === endpoint.path
      && candidate.authentication === 'public'
      && typeof candidate.scenario === 'string'
      && candidate.scenario.trim().length > 0
      && candidate.exclusionReason === undefined);
    if (!safeRouteExists) {
      throw new Error(`k6 endpoint is not a safe public GET in the route inventory: ${endpoint.path}.`);
    }
  }
}
