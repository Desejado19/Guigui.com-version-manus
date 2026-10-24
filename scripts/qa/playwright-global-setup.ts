import { assertRunningTarget } from './assert-running-target';

export default async function verifyQaTargetBeforePlaywright(): Promise<void> {
  const baseUrl = process.env.QA_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error('QA_BASE_URL must be set before Playwright can verify its target.');
  }
  await assertRunningTarget(baseUrl);
}
