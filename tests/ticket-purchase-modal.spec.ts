import { expect, test } from '@playwright/test';

test('keeps the first ticket-purchase step in the visible top of the card', async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 640 },
    { width: 768, height: 1223 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await page.evaluate(async () => {
      const origin = window.location.origin;
      const reactModule = await import(`${origin}/node_modules/.vite/deps/react.js`);
      const reactDomModule = await import(`${origin}/node_modules/.vite/deps/react-dom_client.js`);
      const { TicketPurchaseModal } = await import(`${origin}/src/components/TicketPurchaseModal.tsx`);
      const React = reactModule.default;
      const { createRoot } = reactDomModule.default;
      const host = document.createElement('div');
      document.body.append(host);
      createRoot(host).render(
        React.createElement(TicketPurchaseModal, {
          isOpen: true,
          onClose: () => {},
          onConfirm: () => {},
        }),
      );
    });

    const modal = page.locator('[aria-label="Compra de bilhete"] .ticket-purchase-modal');
    const overlay = page.getByRole('dialog', { name: 'Compra de bilhete' });
    await expect(overlay.getByRole('button', { name: /Orange Money Bissau/ })).toBeVisible();
    await expect(overlay.getByRole('button', { name: /Telecel Bissau/ })).toBeVisible();
    await expect(overlay.locator('button').filter({ hasText: /Orange Money Bissau|Telecel Bissau|Transferência manual/ })).toHaveCount(2);
    await expect(overlay.getByRole('button', { name: /Transferência manual/ })).toHaveCount(0);
    const categoryHeading = page.getByRole('heading', { name: 'Categoria' });
    const firstStepBadge = categoryHeading.locator('xpath=../..').locator(':scope > div').first();
    const layerOrder = await overlay.evaluate((element) => ({
      modal: Number(getComputedStyle(element).zIndex),
      navbar: Number(getComputedStyle(document.querySelector('.guigui-navbar')!).zIndex),
    }));
    const modalTop = await modal.evaluate((element) => element.getBoundingClientRect().top);
    const badgeBounds = await firstStepBadge.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return { top: bounds.top, bottom: bounds.bottom };
    });
    const viewportHeight = await page.evaluate(() => window.innerHeight);

    expect(layerOrder.modal, 'o modal de compra deve ficar acima da barra de navegação')
      .toBeGreaterThan(layerOrder.navbar);
    expect(modalTop, `cartão começa fora da margem segura em ${viewport.width}×${viewport.height}`).toBeLessThanOrEqual(32);
    expect(badgeBounds.top).toBeGreaterThanOrEqual(0);
    expect(badgeBounds.bottom).toBeLessThanOrEqual(viewportHeight);
  }
});

test('rejects manual transfer at both new-payment API boundaries', async ({ request }) => {
  const purchaseResponse = await request.post('/api/tickets/purchase', {
    data: {
      eventId: 'event-test',
      eventTitle: 'Festival de Teste',
      ticketTypeName: 'VIP',
      priceXOF: 5000,
      buyerName: 'Comprador Teste',
      buyerPhone: '+245955000000',
      paymentMethod: 'manual_transfer',
      policyAccepted: true,
      policyVersion: '1.0',
      policyAcceptedAt: '2026-10-20T00:00:00.000Z',
    },
  });
  expect(purchaseResponse.status()).toBe(400);
  expect(await purchaseResponse.json()).toMatchObject({ code: 'VALIDATION_ERROR' });

  const paymentResponse = await request.post('/api/payments/create', {
    data: {
      useCase: 'subscription_initial',
      payerName: 'Comprador Teste',
      payerPhone: '+245955000000',
      amountXOF: 5000,
      provider: 'manual_transfer',
    },
  });
  expect(paymentResponse.status()).toBe(400);
  expect(await paymentResponse.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
});

test('rejects webhooks while payment providers are simulation-only', async ({ request }) => {
  const response = await request.post('/api/payments/webhook/orange_money', {
    data: { providerRef: 'OM-SIM-TX-1001', status: 'paid' },
  });

  expect(response.status()).toBe(409);
  expect(await response.json()).toMatchObject({ code: 'PAYMENT_PROVIDER_NOT_ACTIVE' });
});

test('submits the selected ticket and handles pending and confirmed payments without contacting the real purchase API', async ({ page }) => {
  const purchaseRequests: Array<{ body: Record<string, unknown>; idempotencyKey?: string }> = [];
  const makeTicket = (number: number) => ({
    id: `ticket-confirmed-${number}`,
    ticketCode: `GUI-TEST-${number}`,
    eventId: 'event-test',
    eventTitle: 'Festival de Teste',
    ticketTypeName: 'VIP',
    priceXOF: 12000,
    buyerName: 'Comprador Teste',
    buyerPhone: '+245955000000',
    qrToken: `QR-TEST-${number}`,
    pinCode: `432${number}`,
    status: 'valid',
    purchasedAt: '2026-12-03T12:00:00.000Z',
    expiresAt: '2026-12-03T18:00:00.000Z',
    paymentMethod: 'orange_money',
  });
  await page.route('**/api/tickets/purchase', async (route) => {
    purchaseRequests.push({
      body: route.request().postDataJSON() as Record<string, unknown>,
      idempotencyKey: route.request().headers()['idempotency-key'],
    });
    if (purchaseRequests.length > 1) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          transaction: { id: 'TXN-CONFIRMED-TEST' },
          ticket: makeTicket(1),
          tickets: [makeTicket(1), makeTicket(2), makeTicket(3)],
          delivery: {
            email: { state: 'sent' },
            notification: { state: 'created' },
            sms: { delivered: true, mode: 'live' },
          },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        paymentPending: true,
        transaction: { id: 'TXN-TEST', providerRef: 'MANUAL-TEST' },
        reservationExpiresAt: '2026-12-03T12:00:00.000Z',
        message: 'Transferência pendente para validação.',
      }),
    });
  });

  await page.goto('/');
  await page.evaluate(async () => {
    document.documentElement.classList.add('dark');
    const origin = window.location.origin;
    const reactModule = await import(`${origin}/node_modules/.vite/deps/react.js`);
    const reactDomModule = await import(`${origin}/node_modules/.vite/deps/react-dom_client.js`);
    const { EventsView } = await import(`${origin}/src/components/EventsView.tsx`);
    const host = document.createElement('div');
    document.body.append(host);
    reactDomModule.default.createRoot(host).render(
      reactModule.default.createElement(EventsView, {
        onTicketPurchaseConfirmed: (purchase: Record<string, unknown>) => {
          document.body.dataset.ticketPurchaseNotification = JSON.stringify(purchase);
        },
        currentLang: 'pt',
        currentUser: {
          id: 'user-test',
          name: 'Comprador Teste',
          phone: '+245955000000',
          role: 'user',
          neighborhood: 'Bissau',
          avatarUrl: '',
        },
        events: [{
          id: 'event-test',
          title: 'Festival de Teste',
          organizerName: 'Organizador Teste',
          businessId: 'business-test',
          category: 'Música',
          date: '2026-12-03',
          time: '20:00',
          location: 'Bissau',
          neighborhood: 'Centro',
          coverImage: '',
          description: 'Evento para testar a compra de bilhetes.',
          status: 'active',
          ticketTypes: [
            { id: 'ticket-normal', name: 'Normal', priceXOF: 5000, availableQuantity: 10, soldQuantity: 0 },
            { id: 'ticket-vip', name: 'VIP', priceXOF: 12000, availableQuantity: 10, soldQuantity: 0 },
          ],
          totalTicketsSold: 0,
          totalRevenueXOF: 0,
          scannerDoorCode: '',
        }],
      }),
    );
  });

  await page.getByRole('button', { name: 'Comprar Bilhete' }).first().click();

  const dialog = page.getByRole('dialog', { name: 'Compra de bilhete' });
  await expect(dialog.locator('.ticket-category-option')).toHaveCount(2);
  await dialog.locator('.ticket-category-option').nth(1).click();
  await dialog.getByRole('button', { name: '+' }).click();
  await dialog.getByRole('button', { name: '+' }).click();
  await dialog.getByRole('checkbox').check();
  const displayedTotal = await dialog.locator('.ticket-receipt-line').innerText();
  expect(displayedTotal.replace(/\s/g, '')).toContain('36000XOF');
  await dialog.getByRole('button', { name: /Telecel Bissau/ }).click();
  await dialog.getByRole('button', { name: /Confirmar e Pagar/ }).click();

  const pendingDialog = page.getByRole('dialog', { name: 'Pagamento pendente' });
  await expect(pendingDialog).toContainText('Transferência pendente para validação.');
  await expect(pendingDialog).toContainText('MANUAL-TEST');
  expect(purchaseRequests[0].body).toMatchObject({
    eventId: 'event-test',
    eventTitle: 'Festival de Teste',
    businessId: 'business-test',
    ticketTypeId: 'ticket-vip',
    ticketTypeName: 'VIP',
    priceXOF: 12000,
    pricePerTicketXOF: 12000,
    quantity: 3,
    chargedAmountXOF: 36000,
    paymentMethod: 'telecel',
    policyAccepted: true,
  });

  await pendingDialog.getByRole('button', { name: 'Fechar' }).click();
  const purchaseTrigger = page.getByRole('button', { name: 'Comprar Bilhete' }).first();
  await purchaseTrigger.click();
  const confirmedDialog = page.getByRole('dialog', { name: 'Compra de bilhete' });
  await confirmedDialog.getByRole('button', { name: /Orange Money Bissau/ }).click();
  await page.setViewportSize({ width: 320, height: 640 });
  await confirmedDialog.getByRole('button', { name: /Confirmar e Pagar/ }).click();

  const receipt = page.getByRole('dialog', { name: 'Comprovativo da compra' });
  await expect(receipt).toBeVisible();
  const openingContentBounds = await receipt.locator('.ticket-success-notice, .ticket-receipt-order-summary').evaluateAll((elements) => (
    elements.map((element) => {
      const bounds = element.getBoundingClientRect();
      return { top: bounds.top, bottom: bounds.bottom };
    })
  ));
  expect(openingContentBounds.every(({ top, bottom }) => top >= 0 && bottom <= 640)).toBe(true);
  await expect(receipt).toContainText('Compra concluída com sucesso');
  await expect(receipt).toContainText('Bilhetes enviados para o e-mail da sua conta.');
  await expect(receipt).toContainText('SMS de confirmação enviado ao titular do bilhete.');
  expect(JSON.parse((await page.locator('body').getAttribute('data-ticket-purchase-notification')) || 'null'))
    .toMatchObject({
      transactionId: 'TXN-CONFIRMED-TEST',
      eventId: 'event-test',
      eventTitle: 'Festival de Teste',
      ticketId: 'ticket-confirmed-1',
      ticketCodes: ['GUI-TEST-1', 'GUI-TEST-2', 'GUI-TEST-3'],
    });
  await expect(receipt.locator('.ticket-proof-status').first()).toContainText('Bilhete válido');
  await expect(receipt).not.toContainText('Aguardando validação');
  await expect(receipt.locator('.ticket-receipt-ticket')).toHaveCount(3);
  await expect(receipt).toContainText('GUI-TEST-1');
  await expect(receipt).toContainText('GUI-TEST-2');
  await expect(receipt).toContainText('GUI-TEST-3');
  const orderSummary = await receipt.locator('.ticket-receipt-order-summary').innerText();
  expect(orderSummary.replace(/\s/g, '')).toContain('36000XOF');
  await expect(receipt).toBeFocused();
  await expect(receipt.locator('.ticket-success-notice')).toBeInViewport();
  await page.keyboard.press('Tab');
  await expect(receipt.getByRole('button', { name: 'Bilhete' }).first()).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(receipt.getByRole('button', { name: /comprovativo/i })).toBeFocused();
  expect(purchaseRequests[1].body).toMatchObject({ paymentMethod: 'orange_money' });
  expect(purchaseRequests[1].idempotencyKey).not.toBe(purchaseRequests[0].idempotencyKey);

  const receiptCard = receipt.locator('.ticket-receipt-scroll');
  for (const viewport of [
    { width: 320, height: 640 },
    { width: 768, height: 1223 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(receiptCard).toBeVisible();
    const layout = await receiptCard.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        top: bounds.top,
        bottom: bounds.bottom,
        height: bounds.height,
        overflowY: getComputedStyle(element).overflowY,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        viewportHeight: window.innerHeight,
      };
    });
    expect(layout.top, `receipt card starts outside viewport at ${viewport.width}px`).toBeGreaterThanOrEqual(0);
    expect(layout.bottom, `receipt card ends outside viewport at ${viewport.width}px`).toBeLessThanOrEqual(layout.viewportHeight);
    expect(['auto', 'scroll']).toContain(layout.overflowY);
    if (viewport.width <= 320) expect(layout.scrollHeight).toBeGreaterThan(layout.clientHeight);

    const firstTicket = receipt.locator('.ticket-receipt-ticket').first();
    const ticketLayout = await firstTicket.evaluate((element) => {
      const qr = element.querySelector('.ticket-proof-qr')!.getBoundingClientRect();
      const details = element.querySelector('.ticket-proof-details')!.getBoundingClientRect();
      const actions = element.querySelector('.ticket-proof-actions')!.getBoundingClientRect();
      return { card: element.getBoundingClientRect().toJSON(), qr: qr.toJSON(), details: details.toJSON(), actions: actions.toJSON() };
    });
    expect(ticketLayout.actions.top, `ticket actions should follow details at ${viewport.width}px`)
      .toBeGreaterThanOrEqual(ticketLayout.details.bottom);
    if (viewport.width >= 768) {
      expect(ticketLayout.qr.right, 'QR should align in the left ticket column')
        .toBeLessThanOrEqual(ticketLayout.details.left);
      expect(ticketLayout.actions.width, 'ticket actions should span the card width')
        .toBeGreaterThan(ticketLayout.card.width * 0.9);
    }

    await receiptCard.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect(receipt.getByRole('button', { name: /comprovativo/i })).toBeInViewport();
    await receiptCard.evaluate((element) => { element.scrollTop = 0; });
  }

  await receipt.getByRole('button', { name: /comprovativo/i }).click();
  await expect(purchaseTrigger).toBeFocused();
});
