import { describe, expect, it } from 'vitest';
import { sanitizeDiagnostic } from '../../server/modules/platform-foundation/diagnostics/sanitizeDiagnostic';

describe('platform-foundation diagnostic sanitization', () => {
  it('redacts PostgreSQL connection URLs', () => {
    const diagnostic = sanitizeDiagnostic(
      new Error('connection failed: postgres://guigui:db-password@db.example.test:5432/app'),
    );

    expect(diagnostic).not.toContain('guigui');
    expect(diagnostic).not.toContain('db-password');
    expect(diagnostic).toContain('[REDACTED_DATABASE_URL]');
  });

  it('redacts sensitive key-value credentials', () => {
    const diagnostic = sanitizeDiagnostic(
      new Error('Authorization: Bearer very-secret api_key=api-secret password: pass-secret'),
    );

    expect(diagnostic).not.toContain('very-secret');
    expect(diagnostic).not.toContain('api-secret');
    expect(diagnostic).not.toContain('pass-secret');
  });

  it('truncates diagnostics to the requested maximum length', () => {
    expect(sanitizeDiagnostic(new Error('x'.repeat(100)), 20)).toHaveLength(20);
  });

  it('sanitizes non-Error diagnostic values', () => {
    const diagnostic = sanitizeDiagnostic({ token: 'object-secret', code: 'ECONNRESET' });

    expect(diagnostic).not.toContain('object-secret');
    expect(diagnostic).toContain('ECONNRESET');
  });

  it('redacts authorization credentials in serialized diagnostic objects', () => {
    const diagnostic = sanitizeDiagnostic({
      Authorization: 'Bearer object-bearer-secret',
      code: 'ECONNRESET',
    });

    expect(diagnostic).not.toContain('object-bearer-secret');
    expect(diagnostic).toContain('ECONNRESET');
  });

  it('redacts credentials in compound camel-case keys', () => {
    const diagnostic = sanitizeDiagnostic({
      dbPassword: 'database-secret',
      code: 'ECONNRESET',
    });

    expect(diagnostic).not.toContain('database-secret');
    expect(diagnostic).toContain('ECONNRESET');
  });
});
