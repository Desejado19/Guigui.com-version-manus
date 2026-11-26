import assert from 'node:assert/strict';
import {
  addSubscriptionPeriod,
  getSubscriptionAccessState,
  getSubscriptionAlertCode,
  getSubscriptionRemainingMs,
  shouldBlockBusinessMutation,
} from '../src/utils/subscriptions';

const now = new Date('2026-08-28T12:00:00.000Z');
const baseBusiness = {
  status: 'active' as const,
  subscriptionStatus: 'active' as const,
  subscriptionRenewDate: '2026-12-31T12:00:00.000Z',
};

assert.equal(addSubscriptionPeriod(now, 'monthly').toISOString(), '2026-09-28T12:00:00.000Z');
assert.equal(addSubscriptionPeriod(now, 'annual').toISOString(), '2027-08-28T12:00:00.000Z');
assert.equal(getSubscriptionAlertCode('2026-09-12T12:00:00.000Z', now), '15d');
assert.equal(getSubscriptionAlertCode('2026-09-07T12:00:00.000Z', now), '10d');
assert.equal(getSubscriptionAlertCode('2026-09-02T12:00:00.000Z', now), '5d');
assert.equal(getSubscriptionAlertCode('2026-08-29T12:00:00.000Z', now), '24h');
assert.equal(getSubscriptionAlertCode('2026-08-28T11:59:59.000Z', now), null);
assert.equal(getSubscriptionRemainingMs('2026-08-29T12:00:00.000Z', now), 24 * 60 * 60 * 1000);
assert.equal(getSubscriptionAccessState(baseBusiness, now), 'active');
assert.equal(getSubscriptionAccessState({ ...baseBusiness, subscriptionRenewDate: '2026-08-28T11:59:59.000Z' }, now), 'expired');
assert.equal(getSubscriptionAccessState({ ...baseBusiness, status: 'suspended' }, now), 'suspended');
assert.equal(shouldBlockBusinessMutation({ ...baseBusiness, subscriptionRenewDate: '2026-08-28T11:59:59.000Z' }, now), true);
assert.equal(shouldBlockBusinessMutation(baseBusiness, now), false);

console.log('subscription-flow-audit: ok — períodos, alertas escalonados e bloqueio validados');
