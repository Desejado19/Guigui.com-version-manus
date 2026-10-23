export type FollowedBusinessesByUser = Record<string, string[]>;

/**
 * Add or remove a business from one user's followed list without duplicates.
 */
export function toggleFollowedBusiness(
  followed: FollowedBusinessesByUser,
  userId: string,
  businessId: string,
): FollowedBusinessesByUser {
  if (!userId || !businessId) return followed;
  const current = Array.isArray(followed[userId]) ? followed[userId] : [];
  const nextIds = current.includes(businessId)
    ? current.filter((id) => id !== businessId)
    : [...current, businessId];
  return { ...followed, [userId]: Array.from(new Set(nextIds)) };
}

/**
 * Resolve all followers from the canonical userId -> businessIds map.
 * Also accepts the legacy businessId -> userIds shape during migration.
 */
export function getFollowerIdsForBusiness(
  followed: FollowedBusinessesByUser,
  businessId: string,
): string[] {
  if (!businessId || !followed || typeof followed !== 'object') return [];
  const mappedFollowers = Object.entries(followed)
    .filter(([, followedIds]) => Array.isArray(followedIds) && followedIds.includes(businessId))
    .map(([userId]) => userId);
  const legacyFollowers = Array.isArray(followed[businessId]) ? followed[businessId] : [];
  return Array.from(new Set([...mappedFollowers, ...legacyFollowers]));
}
