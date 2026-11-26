import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Business } from '../../src/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalDataDirectory = process.env.GUIGUI_DATA_DIR;
let tempDirectory: string;
let store: typeof import('../../server/jsonBusinessStore');

const business: Business = {
  id: 'business-1',
  name: 'Atelier Nô Pintcha',
  slug: 'atelier-no-pintcha',
  logo: '',
  coverImage: '',
  gallery: [],
  description: 'Costura e reparação de roupas.',
  categoryId: 'services',
  subcategoryId: 'tailoring',
  groupGroupId: 'servicos_profissionais',
  tier: 'basic',
  neighborhood: 'Bissau Velho',
  address: '',
  phone: '+245 955 123 456',
  whatsapp: '',
  openingHours: '',
  isOpenNow: false,
  priceRange: '$',
  status: 'pending',
  verified: false,
  featured: false,
  ratingLabel: '',
  reviewsCount: 0,
  reviews: [],
  posts: [],
  promotions: [],
  metrics: {
    views: 0,
    whatsappClicks: 0,
    phoneClicks: 0,
    directionsClicks: 0,
    websiteClicks: 0,
  },
  subscriptionRenewDate: '',
  postsQuotaRemaining: 0,
};

beforeEach(async () => {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'guigui-business-store-'));
  process.env.GUIGUI_DATA_DIR = tempDirectory;
  vi.resetModules();
  store = await import('../../server/jsonBusinessStore');
});

afterEach(() => {
  fs.rmSync(tempDirectory, { recursive: true, force: true });
  if (originalDataDirectory === undefined) {
    delete process.env.GUIGUI_DATA_DIR;
  } else {
    process.env.GUIGUI_DATA_DIR = originalDataDirectory;
  }
});

describe('JSON business store', () => {
  it('treats a missing business file as an empty collection', () => {
    expect(store.listJsonBusinesses()).toEqual([]);
  });

  it('round-trips business records without losing profile data', () => {
    store.saveJsonBusinesses([business]);

    expect(store.listJsonBusinesses()).toEqual([business]);
  });

  it('propagates malformed JSON and leaves the invalid file untouched', () => {
    const filePath = path.join(tempDirectory, 'businesses.json');
    fs.writeFileSync(filePath, '{invalid', 'utf8');

    expect(() => store.listJsonBusinesses()).toThrow(SyntaxError);
    expect(fs.readFileSync(filePath, 'utf8')).toBe('{invalid');
  });

  it('rejects valid JSON that is not a business collection', () => {
    fs.writeFileSync(path.join(tempDirectory, 'businesses.json'), '{"id":"business-1"}', 'utf8');

    expect(() => store.listJsonBusinesses()).toThrow(/business collection/i);
  });

  it('propagates business-file read failures', () => {
    fs.mkdirSync(path.join(tempDirectory, 'businesses.json'));

    expect(() => store.listJsonBusinesses()).toThrow();
  });

  it('propagates business-file write failures', () => {
    fs.mkdirSync(path.join(tempDirectory, 'businesses.json'));

    expect(() => store.saveJsonBusinesses([business])).toThrow();
  });
});
