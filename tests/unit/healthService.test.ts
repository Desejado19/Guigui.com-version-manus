import { describe, expect, it } from 'vitest';
import { classifyHealth } from '../../server/healthService';

describe('classifyHealth', () => {
  it('reports ok when local JSON mode has no configured database', () => {
    expect(classifyHealth({ configured: false, connected: false })).toBe('ok');
  });

  it('reports ok when configured PostgreSQL is connected', () => {
    expect(classifyHealth({ configured: true, connected: true })).toBe('ok');
  });

  it('reports degraded when configured PostgreSQL is disconnected', () => {
    expect(classifyHealth({ configured: true, connected: false })).toBe('degraded');
  });
});
