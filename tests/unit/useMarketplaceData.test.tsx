// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_BUSINESSES, INITIAL_EVENTS } from '../../src/data/initialData';
import { useMarketplaceData } from '../../src/hooks/useMarketplaceData';
import type { Business, EventItem } from '../../src/types';

const staleBusiness: Business = { ...INITIAL_BUSINESSES[0], id: 'stale-browser-business' };
const staleEvent: EventItem = { ...INITIAL_EVENTS[0], id: 'stale-browser-event' };

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('useMarketplaceData', () => {
  it('configuredDatabaseIgnoresStaleBrowserData and persists subsequent resource changes', async () => {
    localStorage.setItem('guigui_businesses', JSON.stringify([staleBusiness]));
    localStorage.setItem('guigui_events', JSON.stringify([staleEvent]));
    const newBusiness: Business = { ...INITIAL_BUSINESSES[0], id: 'postgres-business-new' };
    const newEvent: EventItem = { ...INITIAL_EVENTS[0], id: 'postgres-event-new' };
    let resolveHealth!: (response: Response) => void;
    const healthResponse = new Promise<Response>((resolve) => { resolveHealth = resolve; });
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/health') return healthResponse;
      if (url === '/api/categories') return Promise.resolve(jsonResponse({ groups: [], categories: [] }));
      if (url === '/api/businesses' && !init?.method) return Promise.resolve(jsonResponse({ businesses: [] }));
      if (url === '/api/events' && !init?.method) return Promise.resolve(jsonResponse({ events: [] }));
      if (init?.method === 'POST' && ['/api/businesses', '/api/events'].includes(url)) {
        return Promise.resolve(jsonResponse({ success: true }));
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useMarketplaceData());
    expect(result.current.status).toBe('loading');
    expect(result.current.businesses).toEqual([]);
    expect(result.current.events).toEqual([]);

    await act(async () => {
      resolveHealth(jsonResponse({ database: { configured: true } }));
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.source).toBe('postgres');
    expect(result.current.businesses).toEqual([]);
    expect(result.current.events).toEqual([]);
    expect(result.current.categories).toEqual([]);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/app-state'))).toBe(false);

    act(() => {
      result.current.setBusinesses([newBusiness]);
      result.current.setEvents([newEvent]);
    });
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url, init]) => String(url) === '/api/businesses' && init?.method === 'POST')).toBe(true);
      expect(fetchMock.mock.calls.some(([url, init]) => String(url) === '/api/events' && init?.method === 'POST')).toBe(true);
    });

    const businessPost = fetchMock.mock.calls.find(([url, init]) => String(url) === '/api/businesses' && init?.method === 'POST');
    const eventPost = fetchMock.mock.calls.find(([url, init]) => String(url) === '/api/events' && init?.method === 'POST');
    expect(JSON.parse(String(businessPost?.[1]?.body))).toEqual(newBusiness);
    expect(JSON.parse(String(eventPost?.[1]?.body))).toEqual(newEvent);
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).includes('/api/app-state') && init?.method === 'POST')).toBe(false);
  });

  it('preservesLocalMarketplaceWhenDatabaseIsNotConfigured', async () => {
    localStorage.setItem('guigui_businesses', JSON.stringify([staleBusiness]));
    localStorage.setItem('guigui_events', JSON.stringify([staleEvent]));
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/health') return jsonResponse({ database: { configured: false } });
      if (url === '/api/businesses') return jsonResponse({ businesses: [] });
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useMarketplaceData());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current.source).toBe('local');
    expect(result.current.businesses).toEqual([staleBusiness]);
    expect(result.current.events).toEqual([staleEvent]);
    expect(result.current.groups).toHaveLength(5);
    expect(result.current.categories).toHaveLength(16);
  });

  it('keeps browser edits durable when the local business API is unavailable', async () => {
    localStorage.setItem('guigui_businesses', JSON.stringify([staleBusiness]));
    localStorage.setItem('guigui_events', JSON.stringify([staleEvent]));
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/health') return jsonResponse({ database: { configured: false } });
      if (String(input) === '/api/businesses') return jsonResponse({ error: 'unavailable' }, 503);
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useMarketplaceData());
    await waitFor(() => expect(result.current.status).toBe('error'));

    const editedEvent = { ...staleEvent, title: 'Alteração local' };
    act(() => result.current.setEvents([editedEvent]));

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('guigui_events') || '[]')).toEqual([editedEvent]);
    });
    expect(result.current.source).toBe('local');
    expect(result.current.events).toEqual([editedEvent]);
  });

  it('enters an explicit error state on a configured database request failure without using local data', async () => {
    localStorage.setItem('guigui_businesses', JSON.stringify([staleBusiness]));
    localStorage.setItem('guigui_events', JSON.stringify([staleEvent]));
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/health') return jsonResponse({ database: { configured: true } });
      if (url === '/api/categories') return jsonResponse({ error: 'database unavailable' }, 500);
      if (url === '/api/businesses') return jsonResponse({ businesses: [] });
      if (url === '/api/events') return jsonResponse({ events: [] });
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useMarketplaceData());
    await waitFor(() => expect(result.current.status).toBe('error'));

    expect(result.current.source).toBe('postgres');
    expect(result.current.error).toBeTruthy();
    expect(result.current.businesses).toEqual([]);
    expect(result.current.events).toEqual([]);
    expect(result.current.categories).toEqual([]);
  });

  it('clears a resource persistence error after a successful retry', async () => {
    let failEventWrites = true;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/health') return jsonResponse({ database: { configured: true } });
      if (url === '/api/categories') return jsonResponse({ groups: [], categories: [] });
      if (url === '/api/businesses' && !init?.method) return jsonResponse({ businesses: [] });
      if (url === '/api/events' && !init?.method) return jsonResponse({ events: [] });
      if (url === '/api/events' && init?.method === 'POST') {
        return failEventWrites ? jsonResponse({ error: 'temporarily unavailable' }, 503) : jsonResponse({ success: true });
      }
      return jsonResponse({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useMarketplaceData());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    const event = { ...INITIAL_EVENTS[0], id: 'event-retry' };
    act(() => result.current.setEvents([event]));
    await waitFor(() => expect(result.current.error).toContain('/api/events'));

    failEventWrites = false;
    act(() => result.current.setEvents([{ ...event, title: 'Retry successful' }]));
    await waitFor(() => expect(result.current.error).toBeNull());
  });
});
