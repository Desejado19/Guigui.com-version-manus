// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TransactionsManagementPage } from '../../../src/components/admin/management/TransactionsManagementPage';
import type { PaymentTransaction } from '../../../src/types';

const simulatedPayment = {
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
} as unknown as PaymentTransaction;

describe('TransactionsManagementPage payment history', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('labels simulated payments in the payment history', async () => {
    render(<TransactionsManagementPage transactions={[simulatedPayment]} onBack={() => undefined} />);

    expect(await screen.findByText('Confirmado em modo simulado')).toBeTruthy();
  });
});
