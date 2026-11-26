import assert from 'node:assert/strict';
import {
  DEFAULT_SUBSCRIPTION_FEATURES,
  DEFAULT_SUBSCRIPTION_PLANS,
  buildPlanVersion,
  canCreatePost,
  getAnnualPlanPrice,
  getBusinessPlan,
  getBusinessUsage,
  getPlanById,
  hasPlanFeature,
  limitAllows,
  limitLabel,
  normaliseSubscriptionPlans,
} from '../src/data/subscriptionCatalog';
import type { Business } from '../src/types';

const baseBusiness = (overrides: Partial<Business> = {}): Business => ({
  id: 'biz-test', name: 'Negócio Teste', slug: 'negocio-teste', logo: '', coverImage: '', gallery: [], description: '', categoryId: '', subcategoryId: '', groupGroupId: 'restauracao', tier: 'professional', neighborhood: 'Bissau', address: '', phone: '', whatsapp: '', openingHours: '', isOpenNow: true, priceRange: '$$', status: 'active', verified: true, featured: false, ratingLabel: 'Muito Bom', reviewsCount: 0, reviews: [], posts: [], promotions: [], metrics: { views: 0, whatsappClicks: 0, phoneClicks: 0, directionsClicks: 0, websiteClicks: 0 }, subscriptionRenewDate: '2026-12-31T00:00:00.000Z', postsQuotaRemaining: 3, ...overrides,
});

const plans = normaliseSubscriptionPlans(DEFAULT_SUBSCRIPTION_PLANS);
const professional = getPlanById(plans, 'plan-professional');
const enterprise = getPlanById(plans, 'plan-enterprise');

assert.equal(plans.length, 4, 'os quatro planos iniciais devem estar disponíveis');
assert.equal(professional.price, 10000, 'o preço inicial vem do catálogo, não de uma regra no checkout');
assert.equal(getAnnualPlanPrice(professional, 15), 102000, 'o desconto anual deve ser calculado pelo catálogo');
assert.equal(limitLabel(enterprise.postsPerMonth), 'Ilimitado', 'limites ilimitados têm representação própria');
assert.equal(limitAllows('unlimited', 999999), true, 'limite ilimitado não depende de 999999');
assert.equal(limitAllows(3, 3), false, 'limite numérico impede a quarta utilização');
assert.equal(hasPlanFeature(professional, 'promotions', DEFAULT_SUBSCRIPTION_FEATURES), true, 'feature associada ao plano deve ser reconhecida');

const business = baseBusiness();
assert.equal(getBusinessPlan(business, plans).id, 'plan-professional', 'negócio legado resolve pelo escalão');
assert.equal(canCreatePost(business, plans), true, 'negócio dentro da quota pode publicar');
assert.equal(canCreatePost(baseBusiness({ subscriptionUsage: { periodKey: '2026-08', postsUsed: 3, promotionsUsed: 0, eventsUsed: 0, imagesUsed: 0, campaignsUsed: 0, updatedAt: '2026-08-28T00:00:00.000Z' } }), plans, undefined, new Date('2026-08-28T00:00:00.000Z')), false, 'quota mensal esgotada impede publicação');
assert.equal(getBusinessUsage(baseBusiness({ subscriptionUsage: { periodKey: '2025-01', postsUsed: 9, promotionsUsed: 9, eventsUsed: 0, imagesUsed: 0, campaignsUsed: 0, updatedAt: '2025-01-01T00:00:00.000Z' } }), new Date('2026-08-28T00:00:00.000Z')).postsUsed, 0, 'novo mês reinicia utilização sem apagar histórico da assinatura');

const changed = { ...professional, price: 15000, postsPerMonth: 10 as const, limits: { ...professional.limits, max_posts: 10 }, version: 2 };
const version = buildPlanVersion(changed, professional, 'Administrador de teste', 'next_renewal');
assert.equal(version.version, 2, 'alterações geram uma nova versão');
assert.equal(version.changePolicy, 'next_renewal', 'a política comercial fica guardada na versão');
assert.equal(version.changes.some((change) => change.field === 'price'), true, 'o histórico regista campos alterados');

console.log('Subscription catalog audit passed: 16 assertions.');
