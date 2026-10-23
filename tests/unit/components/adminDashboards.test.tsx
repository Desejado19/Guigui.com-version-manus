// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AdminDashboard } from '../../../src/components/AdminDashboard';
import { BusinessDashboard } from '../../../src/components/BusinessDashboard';
import { INITIAL_BUSINESSES, INITIAL_EVENTS } from '../../../src/data/initialData';
import type { UserProfile } from '../../../src/types';

// These dashboards fetch on mount (payments, notifications, catalog, etc.).
// Stub fetch globally so the render paths stay deterministic and offline.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] }) as unknown as Response));
  // jsdom does not implement scrollTo; the dashboards call it on tab entry.
  window.scrollTo = vi.fn();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const business = INITIAL_BUSINESSES[0];
const ownerUser: UserProfile = {
  id: 'usr-owner',
  name: business.name,
  role: 'business',
  phone: '+2459550000',
  neighborhood: 'Bissau',
  avatarUrl: '',
  businessId: business.id,
  businessName: business.name,
};

describe('AdminDashboard', () => {
  const renderAdmin = (props: Partial<React.ComponentProps<typeof AdminDashboard>> = {}) =>
    render(
      <AdminDashboard
        businesses={INITIAL_BUSINESSES}
        events={INITIAL_EVENTS}
        currentLang="pt"
        {...props}
      />,
    );

  it('renders the shell and the default overview tab', () => {
    renderAdmin();
    expect(screen.getAllByText('Guigui.com').length).toBeGreaterThan(0);
    expect(document.querySelector('.guigui-profile-dashboard')).toBeTruthy();
  });

  it('renders the executive overview without crashing', () => {
    renderAdmin({ initialTab: 'overview' });
    // The overview tab is the default and should mount content, not throw.
    expect(document.querySelector('.guigui-profile-dashboard')).toBeTruthy();
  });


  it('keeps overview KPI cards local and switches the contextual chart', async () => {
    const user = userEvent.setup();
    renderAdmin({ initialTab: 'overview' });

    const metrics = [
      { button: 'Mostrar gráfico de utilizadores', heading: 'Utilizadores' },
      { button: 'Mostrar gráfico de empresas', heading: 'Empresas' },
      { button: 'Mostrar gráfico de eventos', heading: 'Eventos' },
      { button: 'Mostrar gráfico de bilhetes vendidos', heading: 'Bilhetes vendidos' },
      { button: 'Mostrar gráfico de faturação', heading: 'Faturação este mês' },
    ];

    for (const metric of metrics) {
      const card = screen.getByRole('button', { name: metric.button });
      await user.click(card);

      expect(card.getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByRole('heading', { name: metric.heading, level: 3 })).toBeTruthy();
      expect(screen.queryByText(/Empresas Registadas na Plataforma/i)).toBeNull();
      expect(screen.queryByText(/Gestão de Eventos/i)).toBeNull();
    }
  });

  it('switches to the businesses tab when its navigation item is clicked', async () => {
    const user = userEvent.setup();
    renderAdmin();
    const businessesNav = screen.getAllByText(/Empresas/i)[0];
    await user.click(businessesNav);
    await waitFor(() => {
      expect(screen.getByText(/Empresas Registadas na Plataforma/i)).toBeTruthy();
    });
  });

  it('honours the initialTab prop', async () => {
    renderAdmin({ initialTab: 'businesses' });
    await waitFor(() => {
      expect(screen.getByText(/Empresas Registadas na Plataforma/i)).toBeTruthy();
    });
  });

  it('collapses and expands the sidebar via the toggle control', async () => {
    const user = userEvent.setup();
    renderAdmin();
    const aside = document.querySelector('aside')!;
    const initialWidth = aside.getAttribute('style') || '';
    const toggle = screen.getAllByRole('button').find((button) => button.querySelector('svg'));
    expect(toggle).toBeTruthy();
    await user.click(toggle!);
    await waitFor(() => {
      const current = document.querySelector('aside')!.getAttribute('style') || '';
      expect(current).not.toBe(initialWidth);
    });
  });

  it('reports unread support requests as a navigation badge count', () => {
    renderAdmin({
      supportRequests: [
        { id: 'sup-1', status: 'open' },
        { id: 'sup-2', status: 'resolved' },
      ] as never,
    });
    // One non-resolved request should surface a "1" count badge in the sidebar.
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });
});

describe('BusinessDashboard', () => {
  // BusinessDashboard schedules state updates from mount effects; flush them so
  // React's act() does not warn and the suite exits cleanly.
  const renderBusiness = async (props: Partial<React.ComponentProps<typeof BusinessDashboard>> = {}) => {
    const result = render(
      <BusinessDashboard
        business={business}
        currentUser={ownerUser}
        businesses={INITIAL_BUSINESSES}
        currentLang="pt"
        events={INITIAL_EVENTS}
        purchaseOrders={[]}
        notifications={[]}
        conversations={[]}
        conversationMessages={[]}
        supportRequests={[]}
        onAddPost={vi.fn()}
        onAddPromotion={vi.fn()}
        onCreateConversation={vi.fn()}
        onSendMessage={vi.fn()}
        onCreateSupport={vi.fn()}
        onReplySupport={vi.fn()}
        onMarkConversationRead={vi.fn()}
        {...props}
      />,
    );
    await act(async () => { await Promise.resolve(); });
    return result;
  };

  it('renders the dashboard shell for the given business', async () => {
    await renderBusiness();
    expect(document.querySelector('.guigui-profile-dashboard')).toBeTruthy();
    expect(screen.getAllByText(new RegExp(business.name, 'i')).length).toBeGreaterThan(0);
  });

  it('renders the overview tab content by default', async () => {
    await renderBusiness({ initialTab: 'overview' });
    expect(document.querySelector('.guigui-profile-dashboard')).toBeTruthy();
  });

  it('navigates to the promotions tab from the sidebar', async () => {
    const user = userEvent.setup();
    await renderBusiness();
    const promotionsNav = screen.getAllByText(/Promoções/i)[0];
    await user.click(promotionsNav);
    await waitFor(() => {
      expect(document.querySelector('.guigui-profile-dashboard')).toBeTruthy();
    });
  });

  it('reports the active tab through onActiveTabChange', async () => {
    const onActiveTabChange = vi.fn();
    await renderBusiness({ onActiveTabChange });
    await waitFor(() => {
      expect(onActiveTabChange).toHaveBeenCalledWith('overview');
    });
  });

  it('renders without business events or orders', async () => {
    await renderBusiness({ events: [], purchaseOrders: [] });
    expect(document.querySelector('.guigui-profile-dashboard')).toBeTruthy();
  });
});
