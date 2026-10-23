// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TicketScannerView } from '../../../src/components/TicketScannerView';
import { INITIAL_EVENTS } from '../../../src/data/initialData';
import type { PurchaseOrder } from '../../../src/types';

const event = INITIAL_EVENTS[0];

const baseOrder: PurchaseOrder = {
  id: 'order-1',
  orderCode: 'GUI-2026-EVT-000458',
  qrToken: 'QR-GUI-DEMO-001',
  businessId: event.businessId || 'biz-1',
  businessName: event.organizerName,
  buyerId: 'usr-1',
  eventId: event.id,
  ticketPin: '4829',
  customerName: 'Carlos Domingos',
  customerPhone: '+2459550000',
  itemType: 'ticket',
  itemTitle: 'VIP (15.000 XOF)',
  quantity: 1,
  totalPriceXOF: 15000,
  paymentMethod: 'orange_money',
  purchasedAt: '2026-01-01T08:00:00.000Z',
  status: 'pending',
};

const renderScanner = (orders: PurchaseOrder[] = [baseOrder], responses: unknown[] = [{ authorized: true }]) => {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => responses.shift() ?? { authorized: true } }) as unknown as Response);
  vi.stubGlobal('fetch', fetchMock);
  const onValidatePurchaseOrder = vi.fn();
  render(
    <TicketScannerView
      events={INITIAL_EVENTS}
      currentLang="pt"
      purchaseOrders={orders}
      onValidatePurchaseOrder={onValidatePurchaseOrder}
    />,
  );
  return { fetchMock, onValidatePurchaseOrder };
};

const authenticate = async () => {
  await userEvent.type(screen.getByPlaceholderText('Ex: PORTA2026'), 'PORTA2026');
  await userEvent.click(screen.getByRole('button', { name: /Abrir Scanner do Evento/ }));
  await screen.findByText('Sessão Ativa de Portaria');
};

const validateByCode = async (code: string) => {
  await userEvent.type(screen.getByPlaceholderText('Ex: GUI-2026-EVT-000458 ou PIN...'), code);
  await userEvent.click(screen.getByRole('button', { name: 'Validar' }));
};

describe('TicketScannerView', () => {
  beforeEach(() => {
    vi.stubGlobal('alert', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders the door login card and blocks short door codes', async () => {
    const { fetchMock } = renderScanner();
    expect(screen.getByText('Módulo 4: Scanner de Portaria')).toBeTruthy();
    expect(screen.getByText('Validação de Entradas & Bilhetes')).toBeTruthy();
    expect(screen.getByText('Demo: PORTA2026')).toBeTruthy();

    await userEvent.type(screen.getByPlaceholderText('Ex: PORTA2026'), '12');
    await userEvent.click(screen.getByRole('button', { name: /Abrir Scanner do Evento/ }));
    expect(alert).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText('Sessão Ativa de Portaria')).toBeNull();
  });

  it('authenticates the door staff and exposes the entry history', async () => {
    const { fetchMock } = renderScanner();
    await authenticate();
    expect(fetchMock).toHaveBeenCalledWith('/api/tickets/scanner-auth', expect.objectContaining({ method: 'POST' }));
    expect(screen.getByText('Pessoas Presentes')).toBeTruthy();
    expect(screen.getByText('Histórico de Entradas em Tempo Real')).toBeTruthy();
    expect(document.querySelectorAll('table tbody tr').length).toBeGreaterThanOrEqual(3);
  });

  it('validates a locally issued ticket and shows the approval banner', async () => {
    const { onValidatePurchaseOrder } = renderScanner();
    await authenticate();
    await validateByCode('GUI-2026-EVT-000458');
    expect(await screen.findByText('BILHETE VÁLIDO')).toBeTruthy();
    expect(onValidatePurchaseOrder).toHaveBeenCalledWith('order-1', 'PORTA2026');
    expect(document.querySelectorAll('table tbody tr').length).toBeGreaterThanOrEqual(4);
  });

  it('warns when an already redeemed ticket is scanned again', async () => {
    renderScanner([{ ...baseOrder, status: 'redeemed', redeemedAt: '2026-01-01T09:00:00.000Z' }]);
    await authenticate();
    await validateByCode('GUI-2026-EVT-000458');
    expect(await screen.findByText('BILHETE JÁ UTILIZADO')).toBeTruthy();
  });

  it('shows the invalid banner when the server rejects the code', async () => {
    const { fetchMock } = renderScanner([], [{ authorized: true }, { valid: false, status: 'invalid', message: 'Código inexistente.' }]);
    await authenticate();
    await validateByCode('INV-CODE-999');
    expect(await screen.findByText('BILHETE INVÁLIDO')).toBeTruthy();
    expect(fetchMock).toHaveBeenLastCalledWith('/api/tickets/validate', expect.objectContaining({ method: 'POST' }));
  });
});
