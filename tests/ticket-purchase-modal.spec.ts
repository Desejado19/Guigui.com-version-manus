import { expect, test, type Page } from '@playwright/test';

const EVENT_TITLE = 'Festival Cultural da Lusofonia & Gumbe Bissau 2026';
const CITIZEN = { email: 'cidadao.teste@guigui.com', password: 'Guigui@2026!' };

async function signInCitizen(page: Page, event: { id: string; title: string; date: string; time: string; location: string; neighborhood: string; organizerName?: string; coverImage?: string }) {
  const login = await page.request.post('/api/auth/login', { data: CITIZEN });
  expect(login.ok(), 'o cidadão demo deve conseguir iniciar sessão').toBeTruthy();
  const payload = await login.json();
  const setCookie = login.headers()['set-cookie'];
  if (setCookie) {
    const cookieString = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
    const match = cookieString.match(/guigui_session=([^;]+)/);
    if (match) {
      await page.context().addCookies([{
        name: 'guigui_session',
        value: match[1],
        url: test.info().project.use.baseURL ?? 'http://127.0.0.1:3000',
        httpOnly: true,
        sameSite: 'Lax',
        secure: false,
      }]);
    }
  }
  await page.addInitScript(({ user, event }) => {
    window.localStorage.setItem('guigui_current_user', JSON.stringify(user));
    window.localStorage.setItem('guigui_current_lang', JSON.stringify('pt'));
    window.localStorage.setItem('guigui_event_reminders', JSON.stringify([{
      id: `reminder-test-${event.id}`,
      eventId: event.id,
      eventTitle: event.title,
      eventDate: '2027-12-20',
      eventTime: '18:00',
      eventLocation: event.location,
      eventNeighborhood: event.neighborhood,
      eventCover: event.coverImage || '',
      organizerName: event.organizerName || '',
      timeframe: 'at_start',
      createdAt: new Date().toISOString(),
      notified: false,
    }]));
  }, { user: payload.user, event });
}

async function openPurchaseModal(
  page: Page,
  event: { title: string },
  quantity: number,
) {
  await page.goto('/');
  await page.getByRole('button', { name: /Agenda Cultural/i }).first().click();
  // O gestor de alertas abre um toast fixo sobre a barra de separadores cerca
  // de 1,2s depois do arranque; sem o fechar, o clique em "Meus Lembretes"
  // fica obstruído em vários viewports.
  await page.getByTitle('Dispensar aviso').click({ timeout: 5000 }).catch(() => undefined);
  const remindersTab = page.getByRole('button', { name: /Meus Lembretes/i });
  await remindersTab.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  await remindersTab.click();
  const reminder = page.getByText(event.title, { exact: false }).first();
  await expect(reminder, 'o evento deve estar nos lembretes do cidadão').toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Comprar Bilhete' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Compra de bilhete' });
  await expect(dialog, 'os lembretes devem abrir o modal de compra').toBeVisible({ timeout: 20_000 });
  for (let index = 1; index < quantity; index += 1) {
    await dialog.getByRole('button', { name: 'Aumentar quantidade' }).click();
  }
  return dialog;
}

test('keeps the first ticket-purchase step in the visible top of the card', async ({ page, request }) => {
  // Percorre quatro viewports com navegação completa em cada um; o limite
  // global de 30s não chega para o percurso inteiro.
  test.slow();
  const eventsPayload = await (await request.get('/api/events')).json();
  const event = (eventsPayload.events || []).find((entry: any) => entry.title === EVENT_TITLE && entry.status === 'published');
  expect(event, 'o evento demo deve existir na API pública').toBeTruthy();
  await signInCitizen(page, event);

  for (const viewport of [
    { width: 320, height: 640 },
    { width: 768, height: 1223 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await openPurchaseModal(page, event, 1);

    const modal = page.locator('[aria-label="Compra de bilhete"] .ticket-purchase-modal');
    const overlay = page.getByRole('dialog', { name: 'Compra de bilhete' });
    await expect(overlay.getByRole('button', { name: /Orange Money Bissau/ })).toBeVisible();
    await expect(overlay.getByRole('button', { name: /Telecel Bissau/ })).toBeVisible();
    await expect(overlay.locator('button').filter({ hasText: /Orange Money Bissau|Telecel Bissau|Transferência manual/ })).toHaveCount(2);
    await expect(overlay.getByRole('button', { name: /Transferência manual/ })).toHaveCount(0);
    const ticketHeading = overlay.getByRole('heading', { name: 'Bilhetes' });
    const layerOrder = await overlay.evaluate((element) => ({
      modal: Number(getComputedStyle(element).zIndex),
      navbar: Number(getComputedStyle(document.querySelector('.guigui-navbar')!).zIndex),
    }));
    const modalTop = await modal.evaluate((element) => element.getBoundingClientRect().top);
    const viewportHeight = await page.evaluate(() => window.innerHeight);

    expect(layerOrder.modal, 'o modal de compra deve ficar acima da barra de navegação')
      .toBeGreaterThan(layerOrder.navbar);
    expect(modalTop, `cartão começa fora da margem segura em ${viewport.width}×${viewport.height}`).toBeLessThanOrEqual(32);
    await expect(ticketHeading, 'o primeiro passo da compra deve estar visível no topo do cartão').toBeInViewport();
    const headingBounds = await ticketHeading.evaluate((element) => element.getBoundingClientRect().toJSON());
    expect(headingBounds.top).toBeGreaterThanOrEqual(0);
    expect(headingBounds.bottom).toBeLessThanOrEqual(viewportHeight);
  }
});

test('rejects manual transfer at both new-payment API boundaries', async ({ page, request }) => {
  const login = await request.post('/api/auth/login', { data: CITIZEN });
  expect(login.ok(), 'a API de compra exige sessão autenticada').toBeTruthy();

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

  const paymentResponse = await page.request.post('/api/payments/create', {
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

test('requires an authenticated buyer before resolving or paying for a valid ticket purchase', async ({ request }) => {
  const response = await request.post('/api/tickets/purchase', {
    headers: { 'Idempotency-Key': `unauthenticated-${Date.now()}` },
    data: {
      eventId: 'unknown-event',
      ticketTypeId: 'unknown-ticket-type',
      ticketTypeName: 'VIP',
      priceXOF: 5000,
      pricePerTicketXOF: 5000,
      quantity: 1,
      chargedAmountXOF: 5000,
      buyerName: 'Untrusted Name',
      buyerPhone: '+245955000000',
      paymentMethod: 'orange_money',
      policyAccepted: true,
      policyVersion: '1.0',
      policyAcceptedAt: '2026-10-20T00:00:00.000Z',
    },
  });

  expect(response.status()).toBe(401);
  expect(await response.json()).toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
});

test('rejects webhooks while payment providers are simulation-only', async ({ request }) => {
  const response = await request.post('/api/payments/webhook/orange_money', {
    data: { providerRef: 'OM-SIM-TX-1001', status: 'paid' },
  });

  expect(response.status()).toBe(409);
  expect(await response.json()).toMatchObject({ code: 'PAYMENT_PROVIDER_NOT_ACTIVE' });
});

test('submits the selected ticket and handles pending and confirmed payments without contacting the real purchase API', async ({ page, request }) => {
  const eventsPayload = await (await request.get('/api/events')).json();
  const event = (eventsPayload.events || []).find((entry: any) => entry.title === EVENT_TITLE && entry.status === 'published');
  expect(event, 'o evento demo deve existir na API pública').toBeTruthy();
  const ticketType = event.ticketTypes[0];
  expect(ticketType, 'o evento demo deve ter uma categoria de bilhete').toBeTruthy();
  const quantity = 3;
  const gross = ticketType.priceXOF * quantity;
  const fee = Math.round(gross * 0.036);
  const buyerTotal = gross + fee;

  const purchaseRequests: Array<{ body: Record<string, unknown>; idempotencyKey?: string }> = [];
  const makeTicket = (number: number) => ({
    id: `ticket-confirmed-${number}`,
    ticketCode: `GUI-TEST-${number}`,
    eventId: event.id,
    eventTitle: event.title,
    ticketTypeName: ticketType.name,
    priceXOF: ticketType.priceXOF,
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
          transaction: { id: 'TXN-CONFIRMED-TEST', providerMode: 'simulated', status: 'confirmed_api' },
          quote: {
            unitPriceXOF: ticketType.priceXOF,
            quantity,
            buyerTotalXOF: buyerTotal,
            feeBreakdown: {
              grossTicketValue: gross,
              percentageFee: fee,
              fixedFee: 0,
              platformRevenue: fee,
              buyerShare: fee,
              organizerShare: 0,
              buyerTotal,
              organizerNet: gross,
              feePayer: 'buyer',
              currency: 'XOF',
            },
          },
          feeBreakdown: {
            grossTicketValue: gross,
            percentageFee: fee,
            fixedFee: 0,
            platformRevenue: fee,
            buyerShare: fee,
            organizerShare: 0,
            buyerTotal,
            organizerNet: gross,
            feePayer: 'buyer',
            currency: 'XOF',
          },
          ticket: makeTicket(1),
          tickets: [makeTicket(1), makeTicket(2), makeTicket(3)],
          delivery: {
            email: { state: 'simulated' },
            notification: { state: 'created' },
            sms: { state: 'simulated', mode: 'simulated' },
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
        transaction: { id: 'TXN-TEST', providerRef: 'TEL-SIM-TXN-TEST', providerMode: 'simulated', status: 'pending_provider' },
        reservationExpiresAt: '2026-12-03T12:00:00.000Z',
        message: 'Pagamento simulado pendente; os bilhetes não foram emitidos.',
      }),
    });
  });

  await signInCitizen(page, event);

  const dialog = await openPurchaseModal(page, event, quantity);
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await expect(dialog.getByText(ticketType.name, { exact: true }).first()).toBeVisible();
  await dialog.getByRole('checkbox').check();
  const displayedTotal = await dialog.locator('.ticket-receipt-line').innerText();
  expect(displayedTotal.replace(/\s/g, '')).toContain(`${gross}XOF`);
  await dialog.getByRole('button', { name: /Telecel Bissau/ }).click();
  await dialog.getByRole('button', { name: /Confirmar e Pagar/ }).click();

  const pendingDialog = page.getByRole('dialog', { name: 'Pagamento pendente' });
  await expect(pendingDialog).toContainText('Pagamento simulado pendente; os bilhetes não foram emitidos.');
  await expect(pendingDialog).toContainText('TEL-SIM-TXN-TEST');
  await expect(pendingDialog).toContainText('Pagamento em modo simulado.');
  await expect(page.getByRole('dialog', { name: 'Comprovativo da compra' })).toHaveCount(0);
  expect(purchaseRequests[0].body).toMatchObject({
    eventId: event.id,
    eventTitle: event.title,
    businessId: event.businessId,
    ticketTypeId: ticketType.id,
    ticketTypeName: ticketType.name,
    priceXOF: ticketType.priceXOF,
    pricePerTicketXOF: ticketType.priceXOF,
    quantity,
    paymentMethod: 'telecel',
    policyAccepted: true,
  });

  await pendingDialog.getByRole('button', { name: 'Fechar' }).click();

  const confirmedDialog = await openPurchaseModal(page, event, quantity);
  await confirmedDialog.getByRole('checkbox').check();
  await confirmedDialog.getByRole('button', { name: /Orange Money Bissau/ }).click();
  await page.setViewportSize({ width: 320, height: 640 });
  await confirmedDialog.getByRole('button', { name: /Confirmar e Pagar/ }).click();

  const receipt = page.getByRole('dialog', { name: 'Comprovativo da compra' });
  await expect(receipt).toBeVisible();
  await expect(receipt.locator('.guigui-voucher')).toHaveCount(3);
  await expect(receipt).toContainText(event.title);
  await expect(receipt).toContainText(ticketType.name);
  await expect(receipt).toContainText('Bilhete válido');
  await expect(receipt).toContainText('GUI-TEST-1');
  await expect(receipt).toContainText('GUI-TEST-2');
  await expect(receipt).toContainText('GUI-TEST-3');
  await expect(receipt).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(receipt.getByRole('button', { name: 'Bilhete' }).first()).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(receipt.getByRole('button', { name: /comprovativo/i })).toBeFocused();
  expect(purchaseRequests[1].body).toMatchObject({ paymentMethod: 'orange_money' });
  expect(purchaseRequests[1].idempotencyKey).not.toBe(purchaseRequests[0].idempotencyKey);

  await receipt.getByRole('button', { name: /comprovativo/i }).click();
  await expect(page.getByRole('button', { name: /Comprar bilhete/i }).first()).toBeFocused();
});
