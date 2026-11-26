import assert from 'node:assert/strict';
import {
  getFollowerIdsForBusiness,
  toggleFollowedBusiness,
  type FollowedBusinessesByUser,
} from '../src/utils/followers.ts';
import {
  buildNotificationsForEvent,
  filterNotificationsForContext,
} from '../src/services/notificationService.ts';

const canonical: FollowedBusinessesByUser = {
  'usr-1': ['biz-1'],
  'usr-2': ['biz-2'],
  'usr-3': ['biz-1', 'biz-2', 'biz-1'],
};

// Unit: resolver followers by the canonical user -> businesses shape.
assert.deepEqual(getFollowerIdsForBusiness(canonical, 'biz-1'), ['usr-1', 'usr-3']);
assert.deepEqual(getFollowerIdsForBusiness(canonical, 'biz-2'), ['usr-2', 'usr-3']);
assert.deepEqual(getFollowerIdsForBusiness(canonical, 'missing'), []);

// Unit: toggle follow is immutable, deduplicated and reversible.
const followedOnce = toggleFollowedBusiness({ 'usr-1': ['biz-1'] }, 'usr-1', 'biz-2');
assert.deepEqual(followedOnce, { 'usr-1': ['biz-1', 'biz-2'] });
const unfollowed = toggleFollowedBusiness(followedOnce, 'usr-1', 'biz-1');
assert.deepEqual(unfollowed, { 'usr-1': ['biz-2'] });
assert.deepEqual(toggleFollowedBusiness({ 'usr-1': ['biz-1', 'biz-1'] }, 'usr-1', 'biz-1'), { 'usr-1': [] });

// Unit: legacy business -> users data remains readable during migration.
assert.deepEqual(getFollowerIdsForBusiness({ 'biz-1': ['usr-9', 'usr-9'] }, 'biz-1'), ['usr-9']);

// Integration: approved followed-business post produces a private user notification.
const postNotifications = getFollowerIdsForBusiness(canonical, 'biz-1').flatMap((userId) =>
  buildNotificationsForEvent({
    eventType: 'FOLLOWED_BUSINESS_POST',
    userId,
    businessId: 'biz-1',
    businessName: 'Empresa X',
    entityType: 'post',
    entityId: 'post-1',
    message: 'Nova publicação',
    metadata: { postId: 'post-1', followedBusinessId: 'biz-1' },
  }),
);
assert.equal(postNotifications.length, 2);
assert.deepEqual(postNotifications.map((n) => n.targetUserId).sort(), ['usr-1', 'usr-3']);
assert.ok(postNotifications.every((n) => n.category === 'followed_business' && n.entityId === 'post-1'));
assert.equal(filterNotificationsForContext(postNotifications, { role: 'user', userId: 'usr-2' }).length, 0);
assert.equal(filterNotificationsForContext(postNotifications, { role: 'user', userId: 'usr-1' }).length, 1);

// Integration: direct messages and support replies use independent preference buckets.
const directMessage = buildNotificationsForEvent({
  eventType: 'NEW_MESSAGE',
  userId: 'usr-1',
  businessId: 'biz-1',
  entityType: 'conversation',
  entityId: 'conversation-1',
  message: 'Olá, ainda há disponibilidade?',
  metadata: { conversationId: 'conversation-1', recipientBusinessId: 'biz-1', subject: 'Reserva' },
});
assert.equal(directMessage.length, 1);
assert.equal(directMessage[0].category, 'messages');
assert.equal(filterNotificationsForContext(directMessage, { role: 'business', businessId: 'biz-1' }).length, 1);
assert.equal(filterNotificationsForContext(directMessage, { role: 'business', businessId: 'biz-2' }).length, 0);

const supportReply = buildNotificationsForEvent({
  eventType: 'SUPPORT_REPLY',
  userId: 'usr-1',
  entityType: 'support',
  entityId: 'support-1',
  message: 'Resposta administrativa',
  metadata: { supportId: 'support-1', recipientUserId: 'usr-1' },
});
assert.equal(supportReply[0].category, 'support');
assert.equal(filterNotificationsForContext(supportReply, { role: 'user', userId: 'usr-1' }, { 'usr-1': { categories: { messages: false }, channels: { in_app: true } } }).length, 1);
assert.equal(filterNotificationsForContext(directMessage, { role: 'user', userId: 'usr-1' }, { 'usr-1': { categories: { messages: false }, channels: { in_app: true } } }).length, 0);

// Regression: payment confirmation remains billing and is not treated as a message.
const payment = buildNotificationsForEvent({
  eventType: 'PAYMENT_CONFIRMED',
  userId: 'usr-1',
  businessId: 'biz-1',
  paymentId: 'pay-1',
  entityType: 'payment',
  entityId: 'pay-1',
  message: 'Subscrição Empresa X',
});
assert.ok(payment.length >= 2);
assert.ok(payment.every((notification) => notification.category === 'billing'));

console.log('PASS follow-notifications: 21 assertions unitárias/integração concluídas');
