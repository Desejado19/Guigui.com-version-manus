import http from 'k6/http';
import { check } from 'k6';

const config = JSON.parse(open('./k6-config.json'));
const routeInventory = JSON.parse(open('../api/route-inventory.json'));
const qaBaseUrl = __ENV.QA_BASE_URL;

if (!/^http:\/\/127\.0\.0\.1:4313\/?$/.test(qaBaseUrl || '')) {
  throw new Error('QA_BASE_URL must target the approved local loopback origin.');
}

const approvedOptions = {
  vus: 10,
  duration: '60s',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate==1'],
  },
};

if (JSON.stringify(config.options) !== JSON.stringify(approvedOptions)) {
  throw new Error('k6 options do not match the approved load-test limits.');
}
if (!Array.isArray(config.endpoints) || config.endpoints.length === 0) {
  throw new Error('k6 endpoint allowlist must not be empty.');
}

for (const endpoint of config.endpoints) {
  const safeRouteExists = routeInventory.some((route) =>
    route.method === 'GET'
    && route.path === endpoint.path
    && route.authentication === 'public'
    && typeof route.scenario === 'string'
    && route.scenario.trim().length > 0
    && route.exclusionReason === undefined);
  if (endpoint.method !== 'GET'
    || endpoint.readOnly !== true
    || !endpoint.path.startsWith('/api/')
    || endpoint.path.includes(':')
    || endpoint.path.includes('*')
    || endpoint.path.includes('?')
    || endpoint.path.includes('#')
    || !safeRouteExists) {
    throw new Error('k6 endpoints must be approved public read-only routes.');
  }
}

export const options = approvedOptions;

export default function readOnlyApiScenario() {
  const endpoint = config.endpoints[Math.floor(Math.random() * config.endpoints.length)];
  const response = http.get(`${qaBaseUrl.replace(/\/$/, '')}${endpoint.path}`, {
    redirects: 0,
    tags: { name: `GET ${endpoint.path}` },
  });

  check(response, {
    [`${endpoint.path} returns a successful response`]: (result) =>
      result.status >= 200 && result.status < 300,
    [`${endpoint.path} returns valid JSON`]: (result) => {
      if (typeof result.body !== 'string' || result.body.length === 0) return false;
      try {
        JSON.parse(result.body);
        return true;
      } catch {
        return false;
      }
    },
  });
}
