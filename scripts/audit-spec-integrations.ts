import assert from 'node:assert/strict';
import { DEFAULT_MONETIZATION_CATALOG, getActiveAdCampaigns, normaliseMonetizationCatalog } from '../src/data/monetizationCatalog';

const now = new Date('2026-08-28T12:00:00.000Z');
const catalog = normaliseMonetizationCatalog({
  ...DEFAULT_MONETIZATION_CATALOG,
  adCampaigns: [
    ...(DEFAULT_MONETIZATION_CATALOG.adCampaigns || []),
    { id: 'expired', productCode: 'HOMEPAGE_BANNER', placementCode: 'homepage_top', title: 'Expirada', startsAt: '2026-01-01T00:00:00.000Z', endsAt: '2026-08-27T23:59:59.000Z', priority: 99, impressions: 0, clicks: 0, isActive: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'inactive', productCode: 'HOMEPAGE_BANNER', placementCode: 'homepage_top', title: 'Inactiva', startsAt: '2026-01-01T00:00:00.000Z', endsAt: '2027-01-01T00:00:00.000Z', priority: 100, impressions: 0, clicks: 0, isActive: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 'future', productCode: 'HOMEPAGE_BANNER', placementCode: 'homepage_top', title: 'Futura', startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2027-01-01T00:00:00.000Z', priority: 100, impressions: 0, clicks: 0, isActive: true, createdAt: '2026-08-28T00:00:00.000Z', updatedAt: '2026-08-28T00:00:00.000Z' },
  ],
}, undefined);
const active = getActiveAdCampaigns(catalog, now);
assert.equal(active.some((campaign) => campaign.id === 'expired'), false, 'campanhas expiradas não aparecem na homepage');
assert.equal(active.some((campaign) => campaign.id === 'inactive'), false, 'campanhas inactivas não aparecem na homepage');
assert.equal(active.some((campaign) => campaign.id === 'future'), false, 'campanhas futuras não aparecem antes do início');
assert.equal(active[0]?.id, 'campaign-welcome-bissau', 'campanha vigente é resolvida por placement e prioridade');
assert.equal(active[0]?.placementCode, 'homepage_top', 'campanha activa respeita o placement configurado');
assert.equal(typeof active[0]?.impressions, 'number', 'métricas de impressões fazem parte da campanha');
assert.equal(typeof active[0]?.clicks, 'number', 'métricas de cliques fazem parte da campanha');
console.log('spec-integrations-audit: ok — campanhas, validade, prioridade e métricas validadas');
