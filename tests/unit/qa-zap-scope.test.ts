import { describe, expect, it } from 'vitest';
import { validateZapScope } from '../../scripts/qa/validate-zap-scope';

describe('validateZapScope', () => {
  it.each(['baseline', 'passive'] as const)('allows the approved loopback target in %s mode', (mode) => {
    expect(() => validateZapScope('http://127.0.0.1:4313', mode)).not.toThrow();
  });

  it.each([
    '',
    'https://example.com',
    'http://localhost:4313',
    'http://192.0.2.1:4313',
    'http://127.0.0.1:3000',
  ])('rejects an unapproved target: %s', (baseUrl) => {
    expect(() => validateZapScope(baseUrl, 'baseline')).toThrow(/QA_BASE_URL|loopback/i);
  });

  it('rejects target URLs with paths, credentials, query strings, or fragments', () => {
    for (const baseUrl of [
      'http://user:pass@127.0.0.1:4313',
      'http://127.0.0.1:4313/app',
      'http://127.0.0.1:4313/?next=elsewhere',
      'http://127.0.0.1:4313/#target',
    ]) {
      expect(() => validateZapScope(baseUrl, 'baseline')).toThrow(/QA_BASE_URL|loopback/i);
    }
  });

  it('rejects active scanning modes at runtime', () => {
    expect(() => Reflect.apply(
      validateZapScope,
      undefined,
      ['http://127.0.0.1:4313', 'active'],
    )).toThrow(/baseline|passive/i);
  });
});
