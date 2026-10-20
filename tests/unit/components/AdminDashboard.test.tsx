// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminDashboard } from '../../../src/components/AdminDashboard';

describe('AdminDashboard payment history', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => ({
      ok: true,
      json: async () => String(input).includes('/api/admin/payments')
        ? {
            transactions: [{
              id: 'payment-simulated-1',
              useCase: 'subscription_initial',
              useCaseLabel: 'Subscription',
              payerName: 'Business owner',
              payerPhone: '+245955000001',
              amountXOF: 1000,
              provider: 'orange_money',
              status: 'confirmed_api',
              isApiIntegrationReady: false,
              providerMode: 'simulated',
              createdAt: '2026-10-20T00:00:00.000Z',
            }],
          }
        : {},
    })));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('labels simulated payments in the payment history', async () => {
    render(<AdminDashboard businesses={[]} events={[]} currentLang="pt" initialTab="financials" />);

    expect(await screen.findByText('Confirmado em modo simulado')).toBeTruthy();
  });
});
