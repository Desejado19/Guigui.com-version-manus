import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BusinessRecord } from '../../server/postgresBusinessService';

const originalDataDirectory = process.env.GUIGUI_DATA_DIR;
const originalDatabaseUrl = process.env.DATABASE_URL;
let tempDirectory: string;
let service: typeof import('../../server/postgresBusinessService');

const initialBusiness: BusinessRecord = {
  id: 'business-1',
  name: 'Atelier Nô Pintcha',
  status: 'pending',
  ownerUserId: 'owner-1',
  data: {
    description: 'Costura e reparação de roupas.',
    logo: '/uploads/atelier-logo.png',
    phone: '+245 955 123 456',
  },
};

beforeEach(async () => {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'guigui-business-persistence-'));
  process.env.GUIGUI_DATA_DIR = tempDirectory;
  process.env.DATABASE_URL = '';
  vi.resetModules();
  service = await import('../../server/postgresBusinessService');
});

afterEach(() => {
  vi.doUnmock('../../server/db');
  vi.resetModules();
  fs.rmSync(tempDirectory, { recursive: true, force: true });
  if (originalDataDirectory === undefined) {
    delete process.env.GUIGUI_DATA_DIR;
  } else {
    process.env.GUIGUI_DATA_DIR = originalDataDirectory;
  }
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

describe('business persistence adapter selection', () => {
  it('persists and lists business records in JSON-only mode', async () => {
    await service.persistPostgresBusiness(initialBusiness);

    await expect(service.listPostgresBusinesses()).resolves.toEqual([
      expect.objectContaining({
        id: 'business-1',
        name: 'Atelier Nô Pintcha',
        status: 'pending',
        ownerUserId: 'owner-1',
        description: initialBusiness.data?.description,
        logo: initialBusiness.data?.logo,
        phone: initialBusiness.data?.phone,
      }),
    ]);
  });

  it('preserves stored profile data when a JSON update changes only selected fields', async () => {
    await service.persistPostgresBusiness(initialBusiness);
    await service.persistPostgresBusiness({
      id: initialBusiness.id,
      name: initialBusiness.name,
      data: { phone: '+245 966 000 111' },
    });

    const businesses = await service.listPostgresBusinesses();
    expect(businesses[0]).toMatchObject({
      description: initialBusiness.data?.description,
      logo: initialBusiness.data?.logo,
      phone: '+245 966 000 111',
    });
  });

  it('stores explicit featured order only for selected active businesses', async () => {
    await service.persistPostgresBusiness({
      id: 'active-a',
      name: 'Empresa A',
      status: 'active',
      data: { homepageFeaturedOrder: 5, tier: 'premium', featured: true },
    });
    await service.persistPostgresBusiness({
      id: 'active-b',
      name: 'Empresa B',
      status: 'active',
      data: { homepageFeaturedOrder: null, tier: 'basic', description: 'Perfil preservado.' },
    });
    await service.persistPostgresBusiness({
      id: 'pending-a',
      name: 'Empresa Pendente',
      status: 'pending',
      data: { tier: 'enterprise' },
    });

    await expect(service.setPostgresBusinessFeaturedOrder(['active-b', 'active-a'])).resolves.toEqual([
      expect.objectContaining({ id: 'active-b', homepageFeaturedOrder: 0 }),
      expect.objectContaining({ id: 'active-a', homepageFeaturedOrder: 1 }),
    ]);
    const businesses = await service.listPostgresBusinesses();
    expect(businesses).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'active-a', homepageFeaturedOrder: 1, featured: true, tier: 'premium' }),
      expect.objectContaining({ id: 'active-b', homepageFeaturedOrder: 0, description: 'Perfil preservado.' }),
      expect.objectContaining({ id: 'pending-a', homepageFeaturedOrder: null, tier: 'enterprise' }),
    ]));
  });

  it('rejects ineligible businesses without changing the saved featured order', async () => {
    await service.persistPostgresBusiness({ id: 'active-a', name: 'Empresa A', status: 'active' });
    await service.persistPostgresBusiness({ id: 'rejected-a', name: 'Empresa Rejeitada', status: 'rejected' });
    await service.setPostgresBusinessFeaturedOrder(['active-a']);

    await expect(service.setPostgresBusinessFeaturedOrder(['rejected-a'])).rejects.toThrow(/ativas/i);
    await expect(service.listPostgresBusinesses()).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'active-a', homepageFeaturedOrder: 0 }),
      expect.objectContaining({ id: 'rejected-a', homepageFeaturedOrder: null }),
    ]));
  });

  it('updates featured ordering through PostgreSQL in a transaction without JSON fallback', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'active-b', status: 'active' }, { id: 'active-a', status: 'active' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            { id: 'active-b', owner_user_id: null, name: 'Empresa B', status: 'active', category_id: null, created_at: '2026-10-23', data: { homepageFeaturedOrder: 0, description: 'Preservada.' } },
            { id: 'active-a', owner_user_id: null, name: 'Empresa A', status: 'active', category_id: null, created_at: '2026-10-23', data: { homepageFeaturedOrder: 1, tier: 'premium' } },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    const pool = { connect: vi.fn().mockResolvedValue(client) };
    vi.doMock('../../server/db', () => ({ databasePool: pool }));
    vi.resetModules();
    const postgresService = await import('../../server/postgresBusinessService');

    await expect(postgresService.setPostgresBusinessFeaturedOrder(['active-b', 'active-a'])).resolves.toMatchObject([
      { id: 'active-b', description: 'Preservada.', homepageFeaturedOrder: 0 },
      { id: 'active-a', tier: 'premium', homepageFeaturedOrder: 1 },
    ]);
    expect(client.query.mock.calls[0][0]).toBe('BEGIN');
    expect(client.query.mock.calls[1][0]).toContain('FOR UPDATE');
    expect(client.query.mock.calls[3][0]).toContain('WITH ORDINALITY');
    expect(client.query.mock.calls[3][1]).toEqual([['active-b', 'active-a']]);
    expect(client.query.mock.calls[5][0]).toBe('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
    expect(fs.existsSync(path.join(tempDirectory, 'businesses.json'))).toBe(false);
  });

  it('assigns an owner to a JSON-persisted business and reports missing records', async () => {
    await service.persistPostgresBusiness(initialBusiness);

    await expect(service.assignPostgresBusinessOwner('business-1', 'owner-2')).resolves.toBe(true);
    await expect(service.assignPostgresBusinessOwner('missing-business', 'owner-2')).resolves.toBe(false);
    await expect(service.listPostgresBusinesses()).resolves.toEqual([
      expect.objectContaining({ id: 'business-1', ownerUserId: 'owner-2' }),
    ]);
  });

  it('propagates PostgreSQL write failures without writing to JSON', async () => {
    const databaseError = new Error('PostgreSQL unavailable');
    const pool = { query: vi.fn().mockRejectedValue(databaseError) };
    vi.doMock('../../server/db', () => ({ databasePool: pool }));
    vi.resetModules();
    const postgresService = await import('../../server/postgresBusinessService');

    await expect(postgresService.persistPostgresBusiness(initialBusiness)).rejects.toBe(databaseError);
    expect(fs.existsSync(path.join(tempDirectory, 'businesses.json'))).toBe(false);
  });

  it('propagates PostgreSQL list failures without returning JSON records', async () => {
    const databaseError = new Error('PostgreSQL unavailable');
    const pool = { query: vi.fn().mockRejectedValue(databaseError) };
    vi.doMock('../../server/db', () => ({ databasePool: pool }));
    vi.resetModules();
    const postgresService = await import('../../server/postgresBusinessService');

    await expect(postgresService.listPostgresBusinesses()).rejects.toBe(databaseError);
    expect(fs.existsSync(path.join(tempDirectory, 'businesses.json'))).toBe(false);
  });

  it('updates profile fields through PostgreSQL and returns preserved server-owned fields', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [{
          id: 'business-1',
          owner_user_id: 'owner-1',
          name: 'Atelier Atualizado',
          status: 'active',
          category_id: 'services',
          created_at: '2026-10-23T00:00:00.000Z',
          data: {
            description: 'Costura e reparação de roupas.',
            verified: true,
            homepageFeaturedOrder: 2,
          },
        }],
      }),
    };
    vi.doMock('../../server/db', () => ({ databasePool: pool }));
    vi.resetModules();
    const postgresService = await import('../../server/postgresBusinessService');

    await expect(postgresService.updatePostgresBusinessProfile('business-1', {
      name: 'Atelier Atualizado',
      description: 'Costura e reparação de roupas.',
    })).resolves.toMatchObject({
      id: 'business-1',
      ownerUserId: 'owner-1',
      status: 'active',
      verified: true,
      homepageFeaturedOrder: 2,
    });
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE companies'),
      ['business-1', 'Atelier Atualizado', null, JSON.stringify({
        name: 'Atelier Atualizado',
        description: 'Costura e reparação de roupas.',
      })],
    );
    expect(fs.existsSync(path.join(tempDirectory, 'businesses.json'))).toBe(false);
  });
});
