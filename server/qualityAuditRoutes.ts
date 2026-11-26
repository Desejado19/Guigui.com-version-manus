import express, { type RequestHandler } from 'express';
import { databaseConfigured } from './db';
import {
  createQualityAuditRun,
  getQualityAuditRun,
  listQualityAuditRuns,
  QUALITY_FINDING_STATUSES,
  runAutomatedQualityChecks,
  updateQualityAuditFinding,
  type QualityFindingStatus,
} from './qualityAuditService';

function databaseUnavailable(res: express.Response): express.Response {
  return res.status(503).json({
    error: 'A base de dados PostgreSQL é necessária para a auditoria de qualidade.',
    code: 'DATABASE_REQUIRED',
  });
}

function queryText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function createQualityAuditRouter(requireAdmin: RequestHandler): express.Router {
  const router = express.Router();
  router.use(requireAdmin);

  router.get('/runs', async (req, res) => {
    if (!databaseConfigured) return databaseUnavailable(res);
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
      const runs = await listQualityAuditRuns(limit);
      res.json({ runs });
    } catch (error) {
      console.error('[Guigui.com] quality audit list error:', error);
      res.status(500).json({ error: 'Não foi possível carregar as execuções de auditoria.' });
    }
  });

  router.get('/runs/:id', async (req, res) => {
    if (!databaseConfigured) return databaseUnavailable(res);
    try {
      const result = await getQualityAuditRun(req.params.id);
      if (!result) return res.status(404).json({ error: 'Execução de auditoria não encontrada.' });
      res.json(result);
    } catch (error) {
      console.error('[Guigui.com] quality audit detail error:', error);
      res.status(500).json({ error: 'Não foi possível carregar o relatório de auditoria.' });
    }
  });

  router.post('/runs', async (_req, res) => {
    if (!databaseConfigured) return databaseUnavailable(res);
    try {
      const run = await runAutomatedQualityChecks('admin-panel');
      res.status(201).json({ run });
    } catch (error) {
      console.error('[Guigui.com] quality audit run error:', error);
      res.status(500).json({ error: 'Não foi possível executar as verificações automáticas.' });
    }
  });

  router.post('/runs/manual', async (req, res) => {
    if (!databaseConfigured) return databaseUnavailable(res);
    try {
      const body = req.body || {};
      if (!Array.isArray(body.findings)) {
        return res.status(400).json({ error: 'findings deve ser uma lista.' });
      }
      const run = await createQualityAuditRun({
        triggeredBy: queryText(body.triggeredBy) || 'admin-panel',
        environment: queryText(body.environment),
        startedAt: queryText(body.startedAt),
        finishedAt: queryText(body.finishedAt),
        notes: queryText(body.notes),
        summary: body.summary,
        checks: Array.isArray(body.checks) ? body.checks : [],
        findings: body.findings,
      });
      res.status(201).json({ run });
    } catch (error) {
      console.error('[Guigui.com] quality audit manual run error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'Não foi possível registar a auditoria.' });
    }
  });

  router.patch('/findings/:id', async (req, res) => {
    if (!databaseConfigured) return databaseUnavailable(res);
    const body = req.body || {};
    const status = queryText(body.status);
    if (status && !QUALITY_FINDING_STATUSES.includes(status as QualityFindingStatus)) {
      return res.status(400).json({ error: 'Estado de problema inválido.' });
    }
    try {
      const finding = await updateQualityAuditFinding(req.params.id, {
        status: status as QualityFindingStatus | undefined,
        cause: typeof body.cause === 'string' ? body.cause : undefined,
        fixApplied: typeof body.fixApplied === 'string' ? body.fixApplied : undefined,
        owner: typeof body.owner === 'string' ? body.owner : undefined,
        retestResult: typeof body.retestResult === 'string' ? body.retestResult : undefined,
      });
      if (!finding) return res.status(404).json({ error: 'Problema de auditoria não encontrado.' });
      res.json({ finding });
    } catch (error) {
      console.error('[Guigui.com] quality finding update error:', error);
      res.status(400).json({ error: 'Não foi possível atualizar o problema.' });
    }
  });

  return router;
}
