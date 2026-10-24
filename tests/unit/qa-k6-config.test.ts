import { describe, expect, it } from 'vitest';
import {
  loadK6Config,
  validateK6Config,
  type K6Endpoint,
  type K6Options,
} from '../../scripts/qa/validate-k6-config';

const approvedOptions: K6Options = {
  vus: 10,
  duration: '60s',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate==1'],
  },
};

const approvedEndpoints: K6Endpoint[] = [
  { method: 'GET', path: '/api/health', readOnly: true },
];

describe('validateK6Config', () => {
  it('loads the shared fixed options and public read-only endpoint allowlist', () => {
    const config = loadK6Config();

    expect(config.options).toEqual(approvedOptions);
    expect(config.endpoints).toEqual([
      { method: 'GET', path: '/api/health', readOnly: true },
      { method: 'GET', path: '/api/businesses', readOnly: true },
      { method: 'GET', path: '/api/businesses/featured', readOnly: true },
      { method: 'GET', path: '/api/categories', readOnly: true },
      { method: 'GET', path: '/api/events', readOnly: true },
    ]);
  });

  it('accepts the approved loopback, read-only configuration', () => {
    expect(() => validateK6Config(
      'http://127.0.0.1:4313',
      approvedOptions,
      approvedEndpoints,
    )).not.toThrow();
  });

  it.each([
    '',
    'https://127.0.0.1:4313',
    'http://localhost:4313',
    'http://192.0.2.1:4313',
    'http://127.0.0.1:3000',
  ])('rejects an unapproved target: %s', (target) => {
    expect(() => validateK6Config(target, approvedOptions, approvedEndpoints))
      .toThrow(/loopback|QA_BASE_URL/i);
  });

  it('rejects any endpoint that is not a read-only GET', () => {
    expect(() => validateK6Config('http://127.0.0.1:4313', approvedOptions, [
      { method: 'POST', path: '/api/health', readOnly: true },
    ])).toThrow(/GET|read-only/i);
  });

  it('rejects endpoints not explicitly marked read-only', () => {
    expect(() => validateK6Config('http://127.0.0.1:4313', approvedOptions, [
      { method: 'GET', path: '/api/health', readOnly: false },
    ])).toThrow(/read-only/i);
  });

  it('rejects a GET path that is not classified safe in the route inventory', () => {
    expect(() => validateK6Config('http://127.0.0.1:4313', approvedOptions, [
      { method: 'GET', path: '/api/not-in-inventory', readOnly: true },
    ])).toThrow(/route inventory|safe/i);
  });

  it('rejects more than the approved 10 virtual users', () => {
    expect(() => validateK6Config('http://127.0.0.1:4313', {
      ...approvedOptions,
      vus: 11,
    }, approvedEndpoints)).toThrow(/vus|virtual users|10/i);
  });

  it('rejects a duration longer than the approved 60 seconds', () => {
    expect(() => validateK6Config('http://127.0.0.1:4313', {
      ...approvedOptions,
      duration: '61s',
    }, approvedEndpoints)).toThrow(/duration|60/i);
  });

  it('rejects altered latency, failure, or check thresholds', () => {
    expect(() => validateK6Config('http://127.0.0.1:4313', {
      ...approvedOptions,
      thresholds: {
        http_req_duration: ['p(95)<3000'],
        http_req_failed: ['rate<0.01'],
        checks: ['rate==1'],
      },
    }, approvedEndpoints)).toThrow(/threshold/i);
  });
});
