import { isAbsolute, relative, resolve, sep } from 'node:path';

const ALLOWED_TOOLS = new Set(['playwright', 'newman', 'k6', 'zap']);

export function resolveQaCampaignArtifactPath(
  projectRoot: string,
  campaignDirectory: string,
  ...segments: string[]
): string {
  const root = resolve(projectRoot);
  const campaignRoot = resolve(root, 'test-results', 'qa');
  const resolvedCampaignDirectory = resolve(campaignDirectory);
  const relativeDirectory = relative(campaignRoot, resolvedCampaignDirectory);
  if (
    !relativeDirectory
    || relativeDirectory === '..'
    || relativeDirectory.startsWith(`..${sep}`)
    || isAbsolute(relativeDirectory)
  ) {
    throw new Error('QA campaign artifacts must be stored beneath test-results/qa.');
  }
  if (segments.length === 0 || segments.some((segment) =>
    !segment || segment === '.' || segment === '..' || isAbsolute(segment)
      || segment.includes('/') || segment.includes('\\')
  )) {
    throw new Error('QA campaign artifact path must contain safe relative path segments.');
  }

  return resolve(resolvedCampaignDirectory, ...segments);
}

export function resolveQaToolOutputDirectory(
  projectRoot: string,
  tool: string,
  campaignDirectory?: string,
): string {
  if (!ALLOWED_TOOLS.has(tool)) {
    throw new Error('QA artifact tool must be one of the approved campaign tools.');
  }

  const root = resolve(projectRoot);
  if (!campaignDirectory) return resolve(root, '.local-qa', tool);

  return resolveQaCampaignArtifactPath(root, campaignDirectory, tool);
}
