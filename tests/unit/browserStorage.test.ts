import { describe, expect, it, beforeEach } from 'vitest';
import { isLargeStateKey } from '../../src/utils/browserStorage';
import { clearStorageIssues, getStorageIssues, reportStorageIssue } from '../../src/utils/storageMonitor';

describe('browserStorage', () => {
  it('routes collections and per-entity lists away from localStorage', () => {
    expect(isLargeStateKey('guigui_events')).toBe(true);
    expect(isLargeStateKey('guigui_businesses')).toBe(true);
    expect(isLargeStateKey('guigui_admin_staff')).toBe(true);
    expect(isLargeStateKey('guigui_scanner_offline_queue_event-1')).toBe(true);
    expect(isLargeStateKey('guigui_marketing_campaigns_business-1')).toBe(true);
  });

  it('keeps small preferences in localStorage', () => {
    expect(isLargeStateKey('guigui_theme_mode')).toBe(false);
    expect(isLargeStateKey('guigui_current_lang')).toBe(false);
    expect(isLargeStateKey('guigui_notification_preferences')).toBe(false);
    expect(isLargeStateKey('guigui_current_user')).toBe(false);
  });

  it('does not classify the account-scoped physical cache key as a base key', () => {
    // A classificação é feita sobre a chave lógica; o prefixo de conta é
    // aplicado apenas no nome físico usado pelo IndexedDB/localStorage.
    expect(isLargeStateKey('guigui:state:business:42:guigui_conversations')).toBe(false);
  });
});

describe('storageMonitor', () => {
  beforeEach(() => clearStorageIssues());

  it('never stores the error message, which may contain user content', () => {
    reportStorageIssue('quota_exceeded', 'guigui_events', new DOMException('payload with private data', 'QuotaExceededError'));

    const [issue] = getStorageIssues();
    expect(issue.kind).toBe('quota_exceeded');
    expect(issue.key).toBe('guigui_events');
    expect(issue.message).toBe('QuotaExceededError');
    expect(JSON.stringify(issue)).not.toContain('private data');
  });

  it('caps the diagnostics list', () => {
    for (let index = 0; index < 60; index += 1) {
      reportStorageIssue('write_failed', `key-${index}`, new Error('ignored'));
    }

    expect(getStorageIssues()).toHaveLength(50);
    expect(getStorageIssues()[0].key).toBe('key-10');
  });
});
