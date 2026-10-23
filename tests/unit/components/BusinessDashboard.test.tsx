// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessDashboard } from '../../../src/components/BusinessDashboard';
import type { Business, UserProfile } from '../../../src/types';

const business: Business = {
  id: 'business-1',
  name: 'Business One',
  slug: 'business-one',
  logo: 'logo.png',
  coverImage: '',
  gallery: [],
  description: '',
  categoryId: 'events',
  subcategoryId: '',
  groupGroupId: 'servicos_profissionais',
  neighborhood: 'Bissau',
  address: '',
  phone: '+245955000001',
  whatsapp: '',
  openingHours: '',
  isOpenNow: true,
  priceRange: '$',
  status: 'active',
  tier: 'basic',
  verified: true,
  featured: false,
  ratingLabel: '',
  reviewsCount: 0,
  reviews: [],
  posts: [],
  promotions: [],
  metrics: { views: 0, whatsappClicks: 0, phoneClicks: 0, directionsClicks: 0, websiteClicks: 0 },
  subscriptionRenewDate: '2030-01-01T00:00:00.000Z',
  subscriptionStatus: 'active',
  postsQuotaRemaining: 0,
};

const currentUser: UserProfile = {
  id: 'user-1',
  name: 'Business Owner',
  role: 'business',
  phone: '+245955000001',
  neighborhood: 'Bissau',
  avatarUrl: '',
  businessId: business.id,
};

function renderDashboard(
  onUpdateBusiness = vi.fn(),
  onSaveBusinessProfile = vi.fn().mockResolvedValue(undefined),
) {
  render(
    <BusinessDashboard
      business={business}
      currentUser={currentUser}
      businesses={[business]}
      currentLang="pt"
      initialTab="my_business"
      onAddPost={vi.fn()}
      onAddPromotion={vi.fn()}
      onUpdateBusiness={onUpdateBusiness}
      onSaveBusinessProfile={onSaveBusinessProfile}
      conversations={[]}
      conversationMessages={[]}
      supportRequests={[]}
      onCreateConversation={vi.fn()}
      onSendMessage={vi.fn()}
      onCreateSupport={vi.fn()}
      onReplySupport={vi.fn()}
      onMarkConversationRead={vi.fn()}
    />,
  );
  return onUpdateBusiness;
}

async function requestExtraPost(status: string) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      transaction: {
        id: 'payment-1',
        status,
        providerMode: 'simulated',
        provider: 'orange_money',
      },
    }),
  });
  vi.stubGlobal('fetch', fetchMock);
  const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
  fireEvent.click(screen.getByRole('button', { name: 'Comprar Post Extra' }));
  fireEvent.click(screen.getByRole('button', { name: /Simular pagamento de .* XOF/ }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  return alert;
}

describe('BusinessDashboard simulated quota purchases', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('does not grant extra post quota for a pending simulated payment', async () => {
    const onUpdateBusiness = renderDashboard();
    const alert = await requestExtraPost('pending_provider');

    expect(onUpdateBusiness).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('simulado'));
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('não foi aplicada'));
  });

  it('grants quota after a confirmed simulated payment without claiming SMS or API delivery', async () => {
    const onUpdateBusiness = renderDashboard();
    const alert = await requestExtraPost('confirmed_api');

    expect(onUpdateBusiness).toHaveBeenCalledWith(expect.objectContaining({
      monetizationWallet: expect.objectContaining({ postsExtraPurchased: 1 }),
    }));
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('modo simulado'));
    expect(alert.mock.calls[0][0]).not.toContain('SMS/API');
  });

  it('does not grant quota from a legacy manually confirmed payment', async () => {
    const onUpdateBusiness = renderDashboard();
    const alert = await requestExtraPost('confirmed_manual');

    expect(onUpdateBusiness).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith(expect.stringContaining('registo manual legado'));
  });

  it('waits for profile persistence before showing the saved state', async () => {
    const onSaveBusinessProfile = vi.fn().mockResolvedValue(undefined);
    renderDashboard(vi.fn(), onSaveBusinessProfile);
    fireEvent.click(screen.getByRole('button', { name: /actualizar dados da empresa/i }));

    await waitFor(() => expect(onSaveBusinessProfile).toHaveBeenCalledWith(expect.objectContaining({
      id: business.id,
      status: business.status,
      tier: business.tier,
      verified: business.verified,
    })));
    await screen.findByText(/dados guardados/i);
  });
});
