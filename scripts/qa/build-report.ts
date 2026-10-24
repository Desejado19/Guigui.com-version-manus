import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PHASE_NAMES = ['playwright', 'newman', 'k6', 'zap'] as const;
const MAX_VUS = 10;
const MAX_DURATION_SECONDS = 60;
const MAX_P95_MS = 2000;
const MAX_FAILURE_RATE = 0.01;

export type CampaignPhaseResult = {
  status: 'passed' | 'failed' | 'blocked' | 'skipped';
  exitCode: number | null;
  artifactPaths: string[];
};

export type CampaignResults = {
  runId: string;
  startedAt: string;
  commit: string;
  branch: string;
  toolVersions: Record<string, string | null>;
  phases: Record<typeof PHASE_NAMES[number], CampaignPhaseResult>;
  e2eCounts: { passed: number; failed: number; skipped: number; blocked: number };
  apiCounts: { inventoried: number; covered: number; excluded: number };
  k6Metrics: {
    vus: number | null;
    durationSeconds: number | null;
    p95Ms: number | null;
    failureRate: number | null;
    checksPassed: boolean | null;
    thresholdsPassed: boolean | null;
  };
  zapCounts: Record<'critical' | 'high' | 'medium' | 'low' | 'informational', number>;
  zapBaselineDelta: { new: number; resolved: number; unchanged: number };
  limitations: string[];
};

export type SanitizedCampaignReport = Omit<CampaignResults, 'phases'> & {
  phases: Record<typeof PHASE_NAMES[number], CampaignPhaseResult>;
};

export type PlaywrightCounts = {
  passed: number;
  failed: number;
  skipped: number;
  blocked: number;
  reportErrors: number;
};

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const GUINEA_BISSAU_PHONE_PATTERN = /(?<!\w)\+?245[\s().-]*\d{2,3}[\s().-]*\d{3,4}[\s().-]*\d{2,4}(?!\w)/g;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;

function sanitizeText(value: string): string {
  return value
    .replace(/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s"'<>]+/gi, '[redacted connection]')
    .replace(/\b(?:set-cookie|cookie)[ \t]*[:=][^\r\n]*/gi, '[redacted cookie]')
    .replace(/(?:^|\n)[ \t]*authorization[ \t]*:[^\r\n]*/gi, '[redacted header]')
    .replace(/\bBearer[ \t]+\S+/gi, '[redacted bearer token]')
    .replace(/\b(?:access[_-]?token|refresh[_-]?token|session[_-]?token|token|password|secret)[ \t]*[:=][ \t]*(?:"[^"]*"|'[^']*'|[^\s,;}\]]+)/gi, '[redacted credential]')
    .replace(/\b(?:raw[ \t]+)?(?:request|response)[ \t]+body[ \t]*[:=][\s\S]*$/i, '[redacted request/response body]')
    .replace(JWT_PATTERN, '[redacted token]')
    .replace(EMAIL_PATTERN, '[redacted email]')
    .replace(GUINEA_BISSAU_PHONE_PATTERN, '[redacted phone]');
}

function sanitizeArtifactPath(artifactPath: string): string {
  const normalized = artifactPath.replace(/\\/g, '/');
  const segments = normalized.split('/');
  if (
    normalized.startsWith('/')
    || /^[A-Za-z]:/.test(normalized)
    || segments.includes('..')
  ) {
    return '[external artifact omitted]';
  }

  return sanitizeText(normalized);
}

function hasK6Measurements(metrics: CampaignResults['k6Metrics']): boolean {
  return metrics.vus !== null
    && metrics.durationSeconds !== null
    && metrics.p95Ms !== null
    && metrics.failureRate !== null
    && metrics.checksPassed !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readPlaywrightCounts(report: unknown): PlaywrightCounts {
  if (!isRecord(report) || !isRecord(report.stats) || !Array.isArray(report.suites)) {
    throw new Error('Playwright JSON must contain statistics and suites.');
  }

  const stats = report.stats;
  const readStat = (name: string): number => {
    const value = stats[name];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      throw new Error(`Playwright JSON contains invalid ${name} statistics.`);
    }
    return value;
  };

  let skipped = 0;
  let blocked = 0;
  const visitSuite = (suite: unknown): void => {
    if (!isRecord(suite)) throw new Error('Playwright JSON contains an invalid suite.');
    const specs = suite.specs ?? [];
    const nestedSuites = suite.suites ?? [];
    if (!Array.isArray(specs) || !Array.isArray(nestedSuites)) {
      throw new Error('Playwright JSON contains invalid suite contents.');
    }

    for (const spec of specs) {
      if (!isRecord(spec) || !Array.isArray(spec.tests)) {
        throw new Error('Playwright JSON contains an invalid test specification.');
      }
      for (const test of spec.tests) {
        if (!isRecord(test) || !Array.isArray(test.results) || !Array.isArray(test.annotations)) {
          throw new Error('Playwright JSON contains an invalid test result.');
        }
        const hasSkipAnnotation = test.annotations.some((annotation) => (
          isRecord(annotation) && (annotation.type === 'skip' || annotation.type === 'fixme')
        ));
        const hasSkippedResult = test.results.some((result) => (
          isRecord(result) && result.status === 'skipped'
        ));

        if (hasSkipAnnotation || hasSkippedResult) {
          skipped += 1;
        } else if (test.results.length === 0) {
          blocked += 1;
        }
      }
    }

    for (const nestedSuite of nestedSuites) visitSuite(nestedSuite);
  };

  for (const suite of report.suites) visitSuite(suite);

  const errors = report.errors ?? [];
  if (!Array.isArray(errors)) throw new Error('Playwright JSON contains invalid error records.');

  return {
    passed: readStat('expected'),
    failed: readStat('unexpected') + readStat('flaky'),
    skipped,
    blocked,
    reportErrors: errors.length,
  };
}

function assessK6Thresholds(results: CampaignResults): boolean | null {
  const phase = results.phases.k6;
  const metrics = results.k6Metrics;
  if (phase.status === 'blocked' || phase.status === 'skipped' || phase.exitCode === null) {
    return null;
  }
  if (!hasK6Measurements(metrics)) return null;
  if (phase.exitCode !== 0) return false;

  return metrics.vus > 0
    && metrics.vus <= MAX_VUS
    && metrics.durationSeconds > 0
    && metrics.durationSeconds <= MAX_DURATION_SECONDS
    && metrics.p95Ms >= 0
    && metrics.p95Ms < MAX_P95_MS
    && metrics.failureRate >= 0
    && metrics.failureRate < MAX_FAILURE_RATE
    && metrics.checksPassed;
}

function sanitizePhase(
  name: typeof PHASE_NAMES[number],
  phase: CampaignPhaseResult,
  thresholdsPassed: boolean | null,
): CampaignPhaseResult {
  let status = phase.status;
  if (status !== 'blocked' && status !== 'skipped' && status !== 'failed') {
    if (phase.exitCode === null) {
      status = 'blocked';
    } else if (phase.exitCode !== 0 || (name === 'k6' && thresholdsPassed === false)) {
      status = 'failed';
    } else if (name === 'k6' && thresholdsPassed === null) {
      status = 'blocked';
    }
  }

  return {
    status,
    exitCode: phase.exitCode,
    artifactPaths: phase.artifactPaths.map(sanitizeArtifactPath),
  };
}

export function buildCampaignReport(results: CampaignResults): SanitizedCampaignReport {
  const thresholdsPassed = assessK6Thresholds(results);
  const phases = Object.fromEntries(
    PHASE_NAMES.map((name) => [
      name,
      sanitizePhase(name, results.phases[name], thresholdsPassed),
    ]),
  ) as SanitizedCampaignReport['phases'];

  return {
    runId: sanitizeText(results.runId),
    startedAt: sanitizeText(results.startedAt),
    commit: sanitizeText(results.commit),
    branch: sanitizeText(results.branch),
    toolVersions: Object.fromEntries(
      Object.entries(results.toolVersions).map(([name, version]) => [
        sanitizeText(name),
        version === null ? null : sanitizeText(version),
      ]),
    ),
    phases,
    e2eCounts: { ...results.e2eCounts },
    apiCounts: { ...results.apiCounts },
    k6Metrics: {
      ...results.k6Metrics,
      thresholdsPassed,
    },
    zapCounts: { ...results.zapCounts },
    zapBaselineDelta: { ...results.zapBaselineDelta },
    limitations: results.limitations.map(sanitizeText),
  };
}

async function main(): Promise<void> {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === '--playwright-counts') {
    const [inputPath] = args;
    if (!inputPath) {
      throw new Error('Usage: tsx scripts/qa/build-report.ts --playwright-counts <playwright-report.json>.');
    }
    const input = JSON.parse(readFileSync(resolve(inputPath), 'utf8')) as unknown;
    process.stdout.write(`${JSON.stringify(readPlaywrightCounts(input))}\n`);
    return;
  }

  const [inputPath, outputPath] = [mode, ...args];
  if (!inputPath || !outputPath) {
    throw new Error('Usage: tsx scripts/qa/build-report.ts <raw-results.json> <sanitized-report.json>.');
  }

  const input = JSON.parse(readFileSync(resolve(inputPath), 'utf8')) as CampaignResults;
  const report = buildCampaignReport(input);
  const destination = resolve(outputPath);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error(
      '[qa:report] Failed:',
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  });
}
