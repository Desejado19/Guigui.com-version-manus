import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  resolveQaCampaignArtifactPath,
  resolveQaToolOutputDirectory,
} from '../../scripts/qa/qa-artifact-paths';

const projectRoot = resolve('C:\\qa-project');
const runDirectory = resolve(projectRoot, 'test-results', 'qa', 'run-1');

describe('resolveQaToolOutputDirectory', () => {
  it('keeps the existing local output directory when no campaign run is supplied', () => {
    expect(resolveQaToolOutputDirectory(projectRoot, 'k6')).toBe(
      resolve(projectRoot, '.local-qa', 'k6'),
    );
  });

  it('places tool output under the requested campaign directory', () => {
    expect(resolveQaToolOutputDirectory(projectRoot, 'k6', runDirectory)).toBe(
      resolve(runDirectory, 'k6'),
    );
  });

  it('rejects campaign output directories outside test-results/qa', () => {
    expect(() => resolveQaToolOutputDirectory(
      projectRoot,
      'k6',
      resolve(projectRoot, 'data'),
    )).toThrow(/test-results[\\/]qa/i);
  });

  it('keeps generated seed SQL inside the campaign directory', () => {
    expect(resolveQaCampaignArtifactPath(
      projectRoot,
      runDirectory,
      'seed',
      'guigui-synthetic-10000.sql',
    )).toBe(resolve(runDirectory, 'seed', 'guigui-synthetic-10000.sql'));
    expect(() => resolveQaCampaignArtifactPath(
      projectRoot,
      runDirectory,
      '..',
      'outside.sql',
    )).toThrow(/artifact path/i);
  });
});
