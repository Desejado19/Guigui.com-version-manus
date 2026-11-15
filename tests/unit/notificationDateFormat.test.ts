import { describe, expect, it } from 'vitest';
import { formatNotificationDateTime, normalizeNotification } from '../../src/services/notificationService';
import type { AppNotification } from '../../src/types';

const baseNotification: AppNotification = {
  id: 'notif-test',
  title: 'Aviso de teste',
  message: 'Mensagem de teste',
  targetRole: 'user',
  category: 'system',
  read: false,
  createdAt: '2026-08-21T18:45:00.000Z',
};

describe('datas das notificações', () => {
  it('apresenta sempre data e hora completas', () => {
    const formatted = formatNotificationDateTime('2026-08-21T18:45:00.000Z', 'pt');

    expect(formatted).toContain('2026');
    expect(formatted).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(formatted).toMatch(/\d{2}:\d{2}/);
  });

  it('recupera createdAt em falta ou inválido', () => {
    const normalized = normalizeNotification({ ...baseNotification, createdAt: '' });

    expect(Number.isNaN(Date.parse(normalized.createdAt))).toBe(false);
    expect(formatNotificationDateTime(normalized.createdAt, 'pt')).toMatch(/\d{2}:\d{2}/);
  });

  it('usa a data guardada nos metadados quando createdAt não existe', () => {
    const normalized = normalizeNotification({
      ...baseNotification,
      createdAt: '',
      metadata: { createdAt: '2026-01-02T03:04:05.000Z' },
    });

    expect(normalized.createdAt).toBe('2026-01-02T03:04:05.000Z');
  });
});
