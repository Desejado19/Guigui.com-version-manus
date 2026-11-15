import { randomUUID } from 'node:crypto';
import { databasePool } from './db';

export const QUALITY_FINDING_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
export const QUALITY_FINDING_STATUSES = [
  'identified',
  'analyzing',
  'fixing',
  'fixed',
  'validating',
  'resolved',
  'reopened',
] as const;

export type QualityFindingPriority = (typeof QUALITY_FINDING_PRIORITIES)[number];
export type QualityFindingStatus = (typeof QUALITY_FINDING_STATUSES)[number];
export type QualityCheckStatus = 'passed' | 'failed' | 'warning';

export interface QualityCheck {
  id: string;
  name: string;
  status: QualityCheckStatus;
  detail: string;
  durationMs: number;
}

export interface QualitySummary {
  screensTested: number | null;
  buttonsTested: number | null;
  formsTested: number | null;
  featuresTested: number | null;
  testsPassed: number;
  testsFailed: number;
  testsSkipped: number;
  checksPassed: number;
  checksFailed: number;
  checksWarnings: number;
  findingsTotal: number;
  findingsResolved: number;
  findingsPending: number;
  criticalOpen: number;
  coverageNote?: string;
}

export interface QualityAuditFinding {
  id: string;
  runId: string;
  code: string;
  module: string;
  screen: string | null;
  element: string | null;
  title: string;
  description: string;
  steps: string | null;
  expectedResult: string | null;
  actualResult: string | null;
  priority: QualityFindingPriority;
  status: QualityFindingStatus;
  cause: string | null;
  fixApplied: string | null;
  owner: string | null;
  identifiedAt: string;
  resolvedAt: string | null;
  retestResult: string | null;
}

export interface QualityAuditRun {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | 'completed' | 'failed';
  triggeredBy: string;
  environment: string;
  summary: QualitySummary;
  checks: QualityCheck[];
  notes: string | null;
  findingsTotal: number;
  findingsResolved: number;
  findingsPending: number;
  criticalOpen: number;
}

export interface QualityFindingInput {
  code: string;
  module: string;
  screen?: string;
  element?: string;
  title: string;
  description: string;
  steps?: string;
  expectedResult?: string;
  actualResult?: string;
  priority: QualityFindingPriority;
  status?: QualityFindingStatus;
  cause?: string;
  fixApplied?: string;
  owner?: string;
  identifiedAt?: string;
  resolvedAt?: string;
  retestResult?: string;
}

interface QualityAuditRunInput {
  triggeredBy: string;
  environment?: string;
  status?: 'completed' | 'failed';
  startedAt?: string;
  finishedAt?: string;
  summary?: Partial<QualitySummary>;
  checks?: QualityCheck[];
  notes?: string;
  findings?: QualityFindingInput[];
}

const EMPTY_SUMMARY: QualitySummary = {
  screensTested: null,
  buttonsTested: null,
  formsTested: null,
  featuresTested: null,
  testsPassed: 0,
  testsFailed: 0,
  testsSkipped: 0,
  checksPassed: 0,
  checksFailed: 0,
  checksWarnings: 0,
  findingsTotal: 0,
  findingsResolved: 0,
  findingsPending: 0,
  criticalOpen: 0,
};

function requirePool() {
  if (!databasePool) {
    throw new Error('PostgreSQL não está configurado para a auditoria de qualidade.');
  }
  return databasePool;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function normalizeSummary(value: unknown, fallbackCounts?: Record<string, unknown>): QualitySummary {
  const source = parseObject(value);
  const pick = (key: keyof QualitySummary) =>
    Object.prototype.hasOwnProperty.call(source, key) ? source[key] : fallbackCounts?.[key];
  return {
    screensTested: toNullableNumber(pick('screensTested')),
    buttonsTested: toNullableNumber(pick('buttonsTested')),
    formsTested: toNullableNumber(pick('formsTested')),
    featuresTested: toNullableNumber(pick('featuresTested')),
    testsPassed: toNumber(pick('testsPassed')),
    testsFailed: toNumber(pick('testsFailed')),
    testsSkipped: toNumber(pick('testsSkipped')),
    checksPassed: toNumber(pick('checksPassed')),
    checksFailed: toNumber(pick('checksFailed')),
    checksWarnings: toNumber(pick('checksWarnings')),
    findingsTotal: toNumber(pick('findingsTotal')),
    findingsResolved: toNumber(pick('findingsResolved')),
    findingsPending: toNumber(pick('findingsPending')),
    criticalOpen: toNumber(pick('criticalOpen')),
    coverageNote: typeof pick('coverageNote') === 'string' ? String(pick('coverageNote')) : undefined,
  };
}

function parseChecks(value: unknown): QualityCheck[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      id: String(item.id || ''),
      name: String(item.name || ''),
      status: item.status === 'failed' ? 'failed' : item.status === 'warning' ? 'warning' : 'passed',
      detail: String(item.detail || ''),
      durationMs: toNumber(item.durationMs),
    }));
}

function mapRun(row: Record<string, unknown>): QualityAuditRun {
  const findingsTotal = toNumber(row.findings_total);
  const findingsResolved = toNumber(row.findings_resolved);
  const findingsPending = toNumber(row.findings_pending);
  const criticalOpen = toNumber(row.critical_open);
  const summary = normalizeSummary(row.summary, {
    findingsTotal,
    findingsResolved,
    findingsPending,
    criticalOpen,
  });

  return {
    id: String(row.id),
    startedAt: new Date(String(row.started_at)).toISOString(),
    finishedAt: row.finished_at ? new Date(String(row.finished_at)).toISOString() : null,
    status: row.status === 'failed' ? 'failed' : row.status === 'running' ? 'running' : 'completed',
    triggeredBy: String(row.triggered_by || 'system'),
    environment: String(row.environment || 'unknown'),
    summary: {
      ...summary,
      findingsTotal,
      findingsResolved,
      findingsPending,
      criticalOpen,
    },
    checks: parseChecks(row.checks),
    notes: typeof row.notes === 'string' ? row.notes : null,
    findingsTotal,
    findingsResolved,
    findingsPending,
    criticalOpen,
  };
}

function mapFinding(row: Record<string, unknown>): QualityAuditFinding {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    code: String(row.code),
    module: String(row.module),
    screen: row.screen ? String(row.screen) : null,
    element: row.element ? String(row.element) : null,
    title: String(row.title),
    description: String(row.description),
    steps: row.steps ? String(row.steps) : null,
    expectedResult: row.expected_result ? String(row.expected_result) : null,
    actualResult: row.actual_result ? String(row.actual_result) : null,
    priority: QUALITY_FINDING_PRIORITIES.includes(row.priority as QualityFindingPriority)
      ? (row.priority as QualityFindingPriority)
      : 'medium',
    status: QUALITY_FINDING_STATUSES.includes(row.status as QualityFindingStatus)
      ? (row.status as QualityFindingStatus)
      : 'identified',
    cause: row.cause ? String(row.cause) : null,
    fixApplied: row.fix_applied ? String(row.fix_applied) : null,
    owner: row.owner ? String(row.owner) : null,
    identifiedAt: new Date(String(row.identified_at)).toISOString(),
    resolvedAt: row.resolved_at ? new Date(String(row.resolved_at)).toISOString() : null,
    retestResult: row.retest_result ? String(row.retest_result) : null,
  };
}

const RUN_COUNT_COLUMNS = `
  (SELECT count(*)::int FROM quality_audit_findings f WHERE f.run_id = r.id) AS findings_total,
  (SELECT count(*)::int FROM quality_audit_findings f WHERE f.run_id = r.id AND f.status = 'resolved') AS findings_resolved,
  (SELECT count(*)::int FROM quality_audit_findings f WHERE f.run_id = r.id AND f.status <> 'resolved') AS findings_pending,
  (SELECT count(*)::int FROM quality_audit_findings f WHERE f.run_id = r.id AND f.priority = 'critical' AND f.status <> 'resolved') AS critical_open
`;

export async function listQualityAuditRuns(limit = 20): Promise<QualityAuditRun[]> {
  const pool = requirePool();
  const result = await pool.query(
    `SELECT r.*, ${RUN_COUNT_COLUMNS}
       FROM quality_audit_runs r
      ORDER BY r.started_at DESC
      LIMIT $1`,
    [Math.min(Math.max(limit, 1), 100)],
  );
  return result.rows.map(mapRun);
}

export async function getQualityAuditRun(id: string): Promise<{ run: QualityAuditRun; findings: QualityAuditFinding[] } | null> {
  const pool = requirePool();
  const runResult = await pool.query(
    `SELECT r.*, ${RUN_COUNT_COLUMNS}
       FROM quality_audit_runs r
      WHERE r.id = $1`,
    [id],
  );
  if (runResult.rows.length === 0) return null;

  const findingsResult = await pool.query(
    `SELECT *
       FROM quality_audit_findings
      WHERE run_id = $1
      ORDER BY
        CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        identified_at DESC`,
    [id],
  );

  return {
    run: mapRun(runResult.rows[0]),
    findings: findingsResult.rows.map(mapFinding),
  };
}

export async function createQualityAuditRun(input: QualityAuditRunInput): Promise<QualityAuditRun> {
  const pool = requirePool();
  const client = await pool.connect();
  const id = `qa-run-${randomUUID()}`;
  const startedAt = input.startedAt || new Date().toISOString();
  const finishedAt = input.finishedAt || new Date().toISOString();
  const findings = input.findings || [];
  const resolved = findings.filter((finding) => finding.status === 'resolved').length;
  const criticalOpen = findings.filter((finding) => finding.priority === 'critical' && finding.status !== 'resolved').length;
  const checks = input.checks || [];
  const summary: QualitySummary = {
    ...EMPTY_SUMMARY,
    ...input.summary,
    checksPassed: input.summary?.checksPassed ?? checks.filter((check) => check.status === 'passed').length,
    checksFailed: input.summary?.checksFailed ?? checks.filter((check) => check.status === 'failed').length,
    checksWarnings: input.summary?.checksWarnings ?? checks.filter((check) => check.status === 'warning').length,
    findingsTotal: findings.length,
    findingsResolved: resolved,
    findingsPending: findings.length - resolved,
    criticalOpen,
  };

  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO quality_audit_runs
        (id, started_at, finished_at, status, triggered_by, environment, summary, checks, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9)`,
      [
        id,
        startedAt,
        finishedAt,
        input.status || 'completed',
        input.triggeredBy,
        input.environment || process.env.NODE_ENV || 'development',
        JSON.stringify(summary),
        JSON.stringify(checks),
        input.notes || null,
      ],
    );

    for (const finding of findings) {
      await client.query(
        `INSERT INTO quality_audit_findings
          (id, run_id, code, module, screen, element, title, description, steps, expected_result,
           actual_result, priority, status, cause, fix_applied, owner, identified_at, resolved_at,
           retest_result)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [
          `qa-finding-${randomUUID()}`,
          id,
          finding.code,
          finding.module,
          finding.screen || null,
          finding.element || null,
          finding.title,
          finding.description,
          finding.steps || null,
          finding.expectedResult || null,
          finding.actualResult || null,
          finding.priority,
          finding.status || 'identified',
          finding.cause || null,
          finding.fixApplied || null,
          finding.owner || null,
          finding.identifiedAt || startedAt,
          finding.resolvedAt || (finding.status === 'resolved' ? finishedAt : null),
          finding.retestResult || null,
        ],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* preserva o erro original */
    }
    throw error;
  } finally {
    client.release();
  }

  const created = await getQualityAuditRun(id);
  if (!created) throw new Error('A execução de auditoria não foi encontrada após a gravação.');
  return created.run;
}

export async function updateQualityAuditFinding(
  id: string,
  patch: {
    status?: QualityFindingStatus;
    cause?: string;
    fixApplied?: string;
    owner?: string;
    retestResult?: string;
  },
): Promise<QualityAuditFinding | null> {
  const pool = requirePool();
  if (patch.status && !QUALITY_FINDING_STATUSES.includes(patch.status)) {
    throw new Error('Estado de problema inválido.');
  }

  const result = await pool.query(
    `UPDATE quality_audit_findings
        SET status = COALESCE($2, status),
            cause = COALESCE($3, cause),
            fix_applied = COALESCE($4, fix_applied),
            owner = COALESCE($5, owner),
            retest_result = COALESCE($6, retest_result),
            resolved_at = CASE
              WHEN $2 = 'resolved' THEN COALESCE(resolved_at, NOW())
              WHEN $2 IS NOT NULL THEN NULL
              ELSE resolved_at
            END,
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [
      id,
      patch.status || null,
      patch.cause ?? null,
      patch.fixApplied ?? null,
      patch.owner ?? null,
      patch.retestResult ?? null,
    ],
  );

  return result.rows[0] ? mapFinding(result.rows[0]) : null;
}

async function runCheck(
  checks: QualityCheck[],
  id: string,
  name: string,
  action: () => Promise<{ status?: QualityCheckStatus; detail: string }>,
): Promise<void> {
  const startedAt = Date.now();
  try {
    const result = await action();
    checks.push({
      id,
      name,
      status: result.status || 'passed',
      detail: result.detail,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    checks.push({
      id,
      name,
      status: 'failed',
      detail: error instanceof Error ? error.message : 'Falha inesperada.',
      durationMs: Date.now() - startedAt,
    });
  }
}

/**
 * Executa verificações automáticas seguras (sem alterar dados operacionais) e
 * persiste o resultado. Não resolve problemas automaticamente: a validação de
 * uma correção continua a ser uma decisão explícita no painel.
 */
export async function runAutomatedQualityChecks(triggeredBy: string): Promise<QualityAuditRun> {
  const pool = requirePool();
  const startedAt = new Date().toISOString();
  const checks: QualityCheck[] = [];

  await runCheck(checks, 'database-connectivity', 'Conectividade com PostgreSQL', async () => {
    const begin = Date.now();
    await pool.query('SELECT 1');
    return { detail: `Consulta de verificação concluída em ${Date.now() - begin} ms.` };
  });

  const requiredTables = [
    'users',
    'companies',
    'events',
    'orders',
    'tickets',
    'payment_transactions',
    'audit_logs',
    'quality_audit_runs',
    'quality_audit_findings',
  ];
  await runCheck(checks, 'required-tables', 'Tabelas obrigatórias do sistema', async () => {
    const result = await pool.query(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])`,
      [requiredTables],
    );
    const present = new Set(result.rows.map((row: Record<string, unknown>) => String(row.table_name)));
    const missing = requiredTables.filter((table) => !present.has(table));
    return missing.length === 0
      ? { detail: `${requiredTables.length} tabelas obrigatórias presentes.` }
      : { status: 'failed', detail: `Tabelas em falta: ${missing.join(', ')}.` };
  });

  await runCheck(checks, 'ticket-referential-integrity', 'Integridade referencial dos bilhetes', async () => {
    const result = await pool.query(
      `SELECT count(*)::int AS n
         FROM tickets t
         LEFT JOIN orders o ON o.id = t.order_id
         LEFT JOIN events e ON e.id = t.event_id
        WHERE o.id IS NULL OR e.id IS NULL`,
    );
    const orphans = toNumber(result.rows[0]?.n);
    return orphans === 0
      ? { detail: 'Nenhum bilhete órfão encontrado.' }
      : { status: 'failed', detail: `${orphans} bilhete(s) sem encomenda ou evento válido.` };
  });

  await runCheck(checks, 'event-referential-integrity', 'Integridade referencial dos eventos', async () => {
    const result = await pool.query(
      `SELECT count(*)::int AS n
         FROM events e
         LEFT JOIN companies c ON c.id = e.company_id
        WHERE e.company_id IS NOT NULL AND c.id IS NULL`,
    );
    const orphans = toNumber(result.rows[0]?.n);
    return orphans === 0
      ? { detail: 'Nenhum evento associado a uma empresa inexistente.' }
      : { status: 'failed', detail: `${orphans} evento(s) sem empresa válida.` };
  });

  await runCheck(checks, 'open-critical-findings', 'Problemas críticos em aberto', async () => {
    const result = await pool.query(
      `SELECT count(*)::int AS n
         FROM quality_audit_findings
        WHERE priority = 'critical' AND status <> 'resolved'`,
    );
    const open = toNumber(result.rows[0]?.n);
    return open === 0
      ? { detail: 'Nenhum problema crítico em aberto.' }
      : { status: 'failed', detail: `${open} problema(s) crítico(s) ainda por resolver.` };
  });

  return createQualityAuditRun({
    triggeredBy,
    environment: process.env.NODE_ENV || 'development',
    startedAt,
    finishedAt: new Date().toISOString(),
    checks,
    summary: {
      screensTested: null,
      buttonsTested: null,
      formsTested: null,
      featuresTested: null,
      testsPassed: checks.filter((check) => check.status === 'passed').length,
      testsFailed: checks.filter((check) => check.status === 'failed').length,
      testsSkipped: 0,
      coverageNote: 'Verificações automáticas de servidor e base de dados. A cobertura funcional de telas, botões e formulários é registada nas execuções manuais.',
    },
    notes: 'Execução automática iniciada no painel de Auditoria e Qualidade. Não altera dados operacionais.',
  });
}
