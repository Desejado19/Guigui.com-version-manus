import assert from 'node:assert/strict';
import type { ModerationLogItem } from '../src/types';
import { filterModerationLogs, getModerationWorkflowColumn, transitionModerationLog } from '../src/utils/moderationWorkflow';

const item = (id: string, status: ModerationLogItem['status'], type: ModerationLogItem['type'], businessName: string, createdAt: string, resultStatus: 'verde' | 'amarelo' | 'vermelho'): ModerationLogItem => ({
  id,
  businessName,
  authorName: `Autor ${id}`,
  authorPhone: '+245 955 00 00',
  type,
  contentSnippet: `${type} de teste ${id}`,
  imageUrl: '',
  result: {
    status: resultStatus,
    reason: 'Teste de pipeline',
    confidence: 90,
    detectedCategories: [],
    suggestedAction: status === 'approved' ? 'approve' : status === 'rejected' ? 'reject' : 'flag_for_human_review',
    isCriouloLanguage: false,
  },
  status,
  createdAt,
  auditTrail: [],
});

const pending = item('pending-1', 'pending_human', 'post', 'Empresa A', '2026-08-10 10:00', 'amarelo');
const approved = transitionModerationLog(pending, 'approved', 'Admin Teste', undefined, new Date('2026-08-10T11:00:00Z'));
const rejected = transitionModerationLog(pending, 'rejected', 'Admin Teste', 'Alegação enganosa', new Date('2026-08-10T12:00:00Z'));
assert.equal(getModerationWorkflowColumn(pending.status), 'pending');
assert.equal(getModerationWorkflowColumn(approved.status), 'approved');
assert.equal(getModerationWorkflowColumn(rejected.status), 'rejected');
assert.equal(approved.reviewedByHuman, true);
assert.equal(rejected.auditTrail.at(-1)?.action, 'human_rejected');

const logs = [pending, approved, rejected, item('promotion-1', 'approved', 'promotion', 'Empresa B', '2026-08-20 10:00', 'verde')];
assert.equal(filterModerationLogs(logs, { workflow: 'approved', type: 'all', businessName: 'all', searchQuery: '', dateFrom: '', dateTo: '' }).length, 2);
assert.equal(filterModerationLogs(logs, { workflow: 'rejected', type: 'all', businessName: 'all', searchQuery: '', dateFrom: '', dateTo: '' }).length, 1);
assert.equal(filterModerationLogs(logs, { workflow: 'all', type: 'promotion', businessName: 'all', searchQuery: '', dateFrom: '', dateTo: '' }).length, 1);
assert.equal(filterModerationLogs(logs, { workflow: 'all', type: 'all', businessName: 'Empresa A', searchQuery: '', dateFrom: '', dateTo: '' }).length, 3);
assert.equal(filterModerationLogs(logs, { workflow: 'all', type: 'all', businessName: 'all', searchQuery: 'promotion-1', dateFrom: '', dateTo: '' }).length, 1);
assert.equal(filterModerationLogs(logs, { workflow: 'all', type: 'all', businessName: 'all', searchQuery: '', dateFrom: '2026-08-15', dateTo: '2026-08-31' }).length, 1);
assert.equal(filterModerationLogs(logs, { workflow: 'amarelo', type: 'all', businessName: 'all', searchQuery: '', dateFrom: '', dateTo: '' }).length, 3);

console.log('moderation-pipeline-audit: ok — transições, colunas e filtros validados');
