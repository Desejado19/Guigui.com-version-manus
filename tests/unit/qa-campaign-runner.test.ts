import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SanitizedCampaignReport } from '../../scripts/qa/build-report';

const projectRoot = resolve('.');

describe('local QA campaign runner', () => {
  it('exposes the campaign runner as the qa:full npm script', () => {
    const packageJson = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts['qa:full']).toContain('run-campaign.ps1');
  });

  it.skipIf(process.platform !== 'win32')(
    'writes a blocked sanitized report without provisioning when QA credentials are absent',
    () => {
      const runner = resolve(projectRoot, 'scripts', 'qa', 'run-campaign.ps1');
      const environmentNames = [
        'PATH',
        'PATHEXT',
        'SystemRoot',
        'WINDIR',
        'TEMP',
        'TMP',
        'USERPROFILE',
        'APPDATA',
        'LOCALAPPDATA',
        'ProgramFiles',
        'ComSpec',
        'PSModulePath',
      ];
      const env = Object.fromEntries(
        environmentNames
          .map((name) => [name, process.env[name]])
          .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
      );
      Object.assign(env, {
        QA_ADMIN_DATABASE_URL: '',
        QA_ADMIN_FIXTURE_PASSWORD: '',
        QA_DATABASE_NAME: '',
        QA_PORT: '',
        DATABASE_URL: 'postgresql://parent-only:must-not-be-inherited@127.0.0.1/production',
        ZAP_HOME: resolve(projectRoot, 'test-results', 'qa', 'test-zap-unavailable'),
      });

      const result = spawnSync('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        runner,
        '-PreflightOnly',
      ], {
        cwd: projectRoot,
        env,
        encoding: 'utf8',
        timeout: 60_000,
      });

      expect(result.error).toBeUndefined();
      expect(result.status).not.toBe(0);
      const reportLine = /Sanitized QA report: ([^\r\n]+)/.exec(result.stdout ?? '');
      expect(reportLine).not.toBeNull();
      if (!reportLine) throw new Error('Campaign runner did not print its sanitized report path.');

      const reportPath = resolve(projectRoot, reportLine[1]);
      const report = JSON.parse(readFileSync(reportPath, 'utf8')) as SanitizedCampaignReport;
      try {
        const routes = JSON.parse(readFileSync(
          resolve(projectRoot, 'tests', 'api', 'route-inventory.json'),
          'utf8',
        )) as Array<{ scenario?: string; exclusionReason?: string }>;
        expect(Object.values(report.phases).map((phase) => phase.status))
          .toEqual(['blocked', 'blocked', 'blocked', 'blocked']);
        expect(report.limitations).toContain(
          'No E2E, Newman, k6, or ZAP execution data were collected; zero result counts are placeholders, not successful results.',
        );
        expect(report.apiCounts).toEqual({
          inventoried: routes.length,
          covered: routes.filter((route) => route.scenario).length,
          excluded: routes.filter((route) => route.exclusionReason).length,
        });
        expect(readFileSync(resolve(
          projectRoot,
          'test-results',
          'qa',
          report.runId,
          'raw',
          'api-inventory-check.log',
        ), 'utf16le')).toContain('API route inventory is complete (98 routes; 74 Newman requests).');
        expect(report.toolVersions.zap).toBeNull();
        expect(report.commit).toMatch(/^[\da-f]{7,40}$/i);
        expect(report.branch).not.toBe('unknown');
        expect(JSON.stringify(report)).not.toContain('parent-only');
        expect(JSON.stringify(report)).not.toContain('must-not-be-inherited');
        expect(existsSync(resolve(
          projectRoot,
          'test-results',
          'qa',
          report.runId,
          'raw',
          'database-provision.log',
        ))).toBe(false);
      } finally {
        rmSync(resolve(projectRoot, 'test-results', 'qa', report.runId), {
          recursive: true,
          force: true,
        });
      }
    },
    30_000,
  );
});
