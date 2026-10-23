import assert from 'node:assert/strict';
import {
  DEFAULT_MONETIZATION_CATALOG,
  calculateTicketFees,
  consumeCredit,
  getCommercialProduct,
  getRemainingCredits,
  normaliseMonetizationCatalog,
  resolveProductPrice,
} from '../src/data/monetizationCatalog';

const catalog = DEFAULT_MONETIZATION_CATALOG;

assert.equal(resolveProductPrice(catalog, 'POST_EXTRA', 1), 5000, 'o pacote avulso legado mantém 5000 XOF');
assert.equal(resolveProductPrice(catalog, 'POST_EXTRA', 5), 8000, 'o pacote +5 usa o preço configurado');
assert.equal(resolveProductPrice(catalog, 'PROMOTION_EXTRA', 10), 75000, 'o pacote +10 de promoções é resolvido pelo catálogo');
assert.equal(resolveProductPrice(catalog, 'HOMEPAGE_BANNER', 1, 30), 80000, 'o banner de 30 dias usa a regra de duração');
assert.equal(resolveProductPrice(catalog, 'PUSH_CAMPAIGN', 1), 0, 'produto que requer orçamento não aceita preço automático');
assert.equal(getCommercialProduct(catalog, 'POST_EXTRA')?.configuration?.creditType, 'posts', 'produto identifica o tipo de crédito');

const ticketFees = calculateTicketFees(catalog, 10000, 1, { commissionPercentage: 5, fixedFee: 250, feePayer: 'organizer' });
assert.equal(ticketFees.percentageFee, 500, 'comissão percentual calculada');
assert.equal(ticketFees.fixedFee, 250, 'taxa fixa calculada');
assert.equal(ticketFees.platformRevenue, 750, 'receita da plataforma calculada');
assert.equal(ticketFees.organizerNet, 9250, 'líquido do organizador calculado');

const first = consumeCredit(3, 0, { postsExtraPurchased: 5, promotionsExtraPurchased: 0, postsExtraUsed: 0, promotionsExtraUsed: 0, updatedAt: new Date().toISOString() }, 'posts', 'included_first');
assert.equal(first.ok && first.source, 'included', 'primeiro consumo usa crédito incluído');
const second = consumeCredit(3, 3, first.wallet!, 'posts', 'included_first');
assert.equal(second.ok && second.source, 'extra', 'depois da quota usa crédito comprado');
assert.equal(second.wallet?.postsExtraUsed, 1, 'consumo extra é contabilizado separadamente');
assert.deepEqual(getRemainingCredits(3, 3, 5, 1), { includedRemaining: 0, extraRemaining: 4, totalRemaining: 4 }, 'saldo de créditos separa incluídos e extras');

const legacy = normaliseMonetizationCatalog(undefined, { extraPostPriceXOF: 4500, extraPromotionPriceXOF: 9000, bannerWeeklyPriceXOF: 60000, ticketCommissionPercent: 7, ticketFixedFeeXOF: 300 });
assert.equal(resolveProductPrice(legacy, 'POST_EXTRA', 1), 4500, 'configuração antiga continua a funcionar como ponte');
assert.equal(legacy.ticketFeePolicy.commissionPercentage, 7, 'comissão legada sincronizada');
assert.equal(legacy.ticketFeePolicy.fixedFee, 300, 'taxa fixa legada sincronizada');

console.log('Monetization engine audit passed: 16 assertions.');
