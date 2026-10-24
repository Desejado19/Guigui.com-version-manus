import { describe, expect, it } from 'vitest';
import {
  buildCampaignReport,
  readPlaywrightCounts,
  readZapSupplementalCounts,
  type CampaignResults,
} from '../../scripts/qa/build-report';

function createCampaignResults(): CampaignResults {
  return {
    runId: '2026-10-24T18-30-00-000Z',
    startedAt: '2026-10-24T18:30:00.000Z',
    commit: '0123456789abcdef',
    branch: 'qa/local-campaign',
    toolVersions: {
      playwright: '1.62.1',
      newman: '6.2.1',
      k6: '2.2.0',
      zap: '2.17.0',
    },
    phases: {
      playwright: {
        status: 'passed',
        exitCode: 0,
        artifactPaths: ['test-results/qa/run-1/playwright/report.html'],
      },
      newman: {
        status: 'passed',
        exitCode: 0,
        artifactPaths: ['test-results/qa/run-1/newman/report.json'],
      },
      k6: {
        status: 'passed',
        exitCode: 0,
        artifactPaths: ['test-results/qa/run-1/k6/summary.json'],
      },
      zap: {
        status: 'passed',
        exitCode: 0,
        artifactPaths: ['test-results/qa/run-1/zap/report.html'],
      },
    },
    e2eCounts: { passed: 18, failed: 0, skipped: 0, blocked: 0 },
    apiCounts: { inventoried: 98, covered: 74, excluded: 24 },
    k6Metrics: {
      vus: 10,
      durationSeconds: 60,
      p95Ms: 1940,
      failureRate: 0,
      checksPassed: true,
      thresholdsPassed: true,
    },
    zapCounts: {
      critical: 0,
      high: 0,
      medium: 4,
      low: 1,
      informational: 2,
    },
    zapConfidenceCounts: {
      high: 1,
      medium: 3,
      low: 2,
      falsePositive: 0,
      unknown: 1,
    },
    zapAlertedEndpointCount: 3,
    zapBaselineDelta: { new: 0, resolved: 0, unchanged: 7 },
    limitations: ['Live-only checks require the reserved isolated QA database.'],
  };
}

describe('buildCampaignReport', () => {
  it('preserves observed campaign results with relative artifact paths', () => {
    const results = createCampaignResults();

    expect(buildCampaignReport(results)).toEqual({
      ...results,
      phases: {
        playwright: {
          status: 'passed',
          exitCode: 0,
          artifactPaths: ['test-results/qa/run-1/playwright/report.html'],
        },
        newman: {
          status: 'passed',
          exitCode: 0,
          artifactPaths: ['test-results/qa/run-1/newman/report.json'],
        },
        k6: {
          status: 'passed',
          exitCode: 0,
          artifactPaths: ['test-results/qa/run-1/k6/summary.json'],
        },
        zap: {
          status: 'passed',
          exitCode: 0,
          artifactPaths: ['test-results/qa/run-1/zap/report.html'],
        },
      },
      k6Metrics: {
        ...results.k6Metrics,
        thresholdsPassed: true,
      },
    });
  });

  describe('readPlaywrightCounts', () => {
    it('counts unstarted tests as blocked separately from intentionally skipped tests', () => {
      const report = {
        stats: { expected: 1, unexpected: 1, flaky: 0, skipped: 2 },
        errors: [],
        suites: [{
          specs: [{
            tests: [
              { status: 'expected', annotations: [], results: [{ status: 'passed' }] },
              { status: 'unexpected', annotations: [], results: [{ status: 'failed' }] },
              {
                status: 'skipped',
                annotations: [{ type: 'skip' }],
                results: [{ status: 'skipped' }],
              },
              { status: 'skipped', annotations: [], results: [] },
            ],
          }],
          suites: [],
        }],
      };

      expect(readPlaywrightCounts(report)).toEqual({
        passed: 1,
        failed: 1,
        skipped: 1,
        blocked: 1,
        reportErrors: 0,
      });
    });

    it('reports collection errors without counting them as test cases', () => {
      const report = {
        stats: { expected: 0, unexpected: 0, flaky: 0, skipped: 0 },
        errors: [{ message: 'Unable to load test file.' }],
        suites: [],
      };

      expect(readPlaywrightCounts(report)).toEqual({
        passed: 0,
        failed: 0,
        skipped: 0,
        blocked: 0,
        reportErrors: 1,
      });
    });
  });

  describe('readZapSupplementalCounts', () => {
    it('reports confidence buckets and distinct endpoints with alerts', () => {
      expect(readZapSupplementalCounts({
        byConfidence: {
          High: 1,
          Medium: 3,
          Low: 2,
          'False Positive': 0,
          Unknown: 1,
        },
        alertedEndpointCount: 3,
      })).toEqual({
        confidenceCounts: {
          high: 1,
          medium: 3,
          low: 2,
          falsePositive: 0,
          unknown: 1,
        },
        alertedEndpointCount: 3,
      });
    });

    it('rejects incomplete or invalid supplemental counts', () => {
      expect(() => readZapSupplementalCounts({
        byConfidence: { High: 1 },
        alertedEndpointCount: 3,
      })).toThrow('ZAP confidence counts are incomplete.');
      expect(() => readZapSupplementalCounts({
        byConfidence: {
          High: 1,
          Medium: 0,
          Low: 0,
          'False Positive': 0,
          Unknown: 0,
        },
        alertedEndpointCount: -1,
      })).toThrow('ZAP alerted endpoint count is invalid.');
    });
  });

  it('keeps unavailable tool phases explicitly blocked', () => {
    const results = createCampaignResults();
    results.phases.newman = { status: 'blocked', exitCode: null, artifactPaths: [] };
    results.phases.k6 = { status: 'blocked', exitCode: null, artifactPaths: [] };
    results.phases.zap = { status: 'blocked', exitCode: null, artifactPaths: [] };

    const report = buildCampaignReport(results);

    expect(report.phases.newman).toEqual({
      status: 'blocked',
      exitCode: null,
      artifactPaths: [],
    });
    expect(report.phases.k6.status).toBe('blocked');
    expect(report.phases.zap.status).toBe('blocked');
  });

  it('derives k6 success from exit status and measured thresholds, not the supplied flag', () => {
    const results = createCampaignResults();
    results.phases.k6.exitCode = 0;
    results.k6Metrics.p95Ms = 2000;
    results.k6Metrics.thresholdsPassed = true;

    const report = buildCampaignReport(results);

    expect(report.k6Metrics.thresholdsPassed).toBe(false);
    expect(report.phases.k6.status).toBe('failed');

    results.k6Metrics.p95Ms = 1940;
    results.k6Metrics.thresholdsPassed = false;
    expect(buildCampaignReport(results).k6Metrics.thresholdsPassed).toBe(true);

    results.phases.k6.exitCode = 1;
    expect(buildCampaignReport(results).k6Metrics.thresholdsPassed).toBe(false);
    expect(buildCampaignReport(results).phases.k6.status).toBe('failed');
  });

  it('removes credentials, cookies, tokens, personal data, and raw request bodies', () => {
    const results = createCampaignResults();
    results.limitations = [
      'Database: postgresql://qauser:fixture-only@127.0.0.1:5432/guigui_pg18_synthetic_target',
      'Set-Cookie: qa_session=fixture-cookie-value; HttpOnly; SameSite=Lax',
      'Authorization: Bearer fixture-token-value',
      'Fixture admin.teste@guigui.com used phone +245 955 123 456.',
      'Raw request body: {"marker":"raw-body-sentinel","email":"qa-user@example.invalid"}',
    ];

    const reportText = JSON.stringify(buildCampaignReport(results));

    for (const sensitiveValue of [
      'postgresql://qauser:fixture-only@127.0.0.1:5432/guigui_pg18_synthetic_target',
      'qa_session=fixture-cookie-value',
      'fixture-token-value',
      'admin.teste@guigui.com',
      '+245 955 123 456',
      'raw-body-sentinel',
      'qa-user@example.invalid',
    ]) {
      expect(reportText).not.toContain(sensitiveValue);
    }
  });
});
