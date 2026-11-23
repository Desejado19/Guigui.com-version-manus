import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { AuditLogCategory, AuditLogEntry, AuditSeverity } from '../../../types';
import { AdminAuditLogsHub } from '../AdminAuditLogsHub';
import { ManagementActionButton, ManagementPage } from './ManagementUi';

interface UsersActivityPageProps {
  onBack: () => void;
}

/**
 * Histórico de atividades do módulo Utilizadores. Lê os registos reais de
 * auditoria (incluindo ações sobre contas, autenticação e sessões).
 */
export const UsersActivityPage: React.FC<UsersActivityPageProps> = ({ onBack }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/audit-logs?limit=1000', { credentials: 'include' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar o histórico.');
      const mapped: AuditLogEntry[] = (Array.isArray(data.logs) ? data.logs : []).map((log: Record<string, unknown>) => ({
        id: String(log.id || ''),
        timestamp: String(log.timestamp || ''),
        actorId: String(log.actorId || 'system'),
        actorName: String(log.actorName || 'Sistema'),
        actorRole: String(log.actorRole || 'system'),
        action: String(log.action || 'unknown'),
        actionLabel: String(log.actionLabel || log.action || 'Ação'),
        category: String(log.category || 'system') as AuditLogCategory,
        severity: String(log.severity || 'info') as AuditSeverity,
        targetEntity: String(log.targetEntity || 'system'),
        targetId: log.targetId ? String(log.targetId) : undefined,
        ipAddress: String(log.ipAddress || '—'),
        deviceInfo: String(log.deviceInfo || '—'),
        details: String(log.details || '—'),
      }));
      setLogs(mapped);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar o histórico.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  return (
    <ManagementPage
      title="Histórico de atividades"
      description="Registos de auditoria das ações administrativas sobre utilizadores, autenticação e sessões, com pesquisa, filtros por categoria e severidade e exportação."
      moduleLabel="Utilizadores"
      breadcrumbTail="Histórico"
      onBack={onBack}
      actions={
        <ManagementActionButton onClick={() => void loadLogs()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </ManagementActionButton>
      }
    >
      {error && <div role="alert" className="rounded-xl border border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] px-3 py-2 text-[11px] font-bold text-[var(--tone-danger-text)]">{error}</div>}
      {loading && logs.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-border-default)] bg-white p-8 text-center text-[11px] font-bold text-slate-500">A carregar histórico…</div>
      ) : (
        <AdminAuditLogsHub logs={logs} currentLang="pt" onRefreshLogs={() => void loadLogs()} />
      )}
    </ManagementPage>
  );
};
