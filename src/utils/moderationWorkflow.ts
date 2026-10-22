import type { ModerationLogItem } from '../types';

export type ModerationWorkflowColumn = 'pending' | 'approved' | 'rejected';

export interface ModerationWorkflowFilters {
  workflow: 'all' | 'pending' | 'approved' | 'rejected' | 'amarelo' | 'vermelho';
  type: 'all' | ModerationLogItem['type'];
  businessName: string;
  searchQuery: string;
  dateFrom: string;
  dateTo: string;
}

export function getModerationWorkflowColumn(status: ModerationLogItem['status']): ModerationWorkflowColumn {
  if (status === 'approved') return 'approved';
  if (status === 'rejected' || status === 'appealed') return 'rejected';
  return 'pending';
}

export function filterModerationLogs(items: ModerationLogItem[], filters: ModerationWorkflowFilters): ModerationLogItem[] {
  const search = filters.searchQuery.trim().toLowerCase();
  const fromTimestamp = filters.dateFrom ? Date.parse(`${filters.dateFrom}T00:00:00`) : null;
  const toTimestamp = filters.dateTo ? Date.parse(`${filters.dateTo}T23:59:59`) : null;

  return items.filter((item) => {
    const workflowColumn = getModerationWorkflowColumn(item.status);
    const createdTimestamp = Date.parse(item.createdAt.replace(' ', 'T'));
    const matchesWorkflow = filters.workflow === 'all'
      || (filters.workflow === 'pending' && workflowColumn === 'pending')
      || (filters.workflow === 'approved' && workflowColumn === 'approved')
      || (filters.workflow === 'rejected' && workflowColumn === 'rejected')
      || (filters.workflow === 'amarelo' && item.result.status === 'amarelo')
      || (filters.workflow === 'vermelho' && (item.result.status === 'vermelho' || workflowColumn === 'rejected'));
    const matchesType = filters.type === 'all' || item.type === filters.type;
    const matchesBusiness = filters.businessName === 'all' || item.businessName === filters.businessName;
    const matchesSearch = !search || `${item.businessName} ${item.authorName} ${item.contentSnippet}`.toLowerCase().includes(search);
    const matchesFrom = fromTimestamp === null || createdTimestamp >= fromTimestamp;
    const matchesTo = toTimestamp === null || createdTimestamp <= toTimestamp;
    return matchesWorkflow && matchesType && matchesBusiness && matchesSearch && matchesFrom && matchesTo;
  });
}

export function transitionModerationLog(item: ModerationLogItem, decision: 'approved' | 'rejected', actor: string, reason?: string, timestamp = new Date()): ModerationLogItem {
  const now = timestamp.toISOString().replace('T', ' ').substring(0, 16);
  return {
    ...item,
    status: decision,
    reviewedByHuman: true,
    reviewedAt: now,
    reviewedBy: actor,
    auditTrail: [
      ...item.auditTrail,
      {
        timestamp: now,
        action: decision === 'approved' ? 'human_approved' : 'human_rejected',
        actor,
        notes: decision === 'approved' ? 'Aprovado na revisão humana.' : `Rejeitado: ${reason || 'Motivo não especificado.'}`,
      },
    ],
  };
}
