import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock,
  Database,
  Download,
  FileText,
  Filter,
  History,
  Loader2,
  Monitor,
  PlayCircle,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { downloadCSV, downloadPDFReport } from '../../utils/exportHelpers';

type Priority = 'critical' | 'high' | 'medium' | 'low';
type FindingStatus = 'identified' | 'analyzing' | 'fixing' | 'fixed' | 'validating' | 'resolved' | 'reopened';

interface QualityCheck {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'warning';
  detail: string;
  durationMs: number;
}

interface QualitySummary {
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
  coverageNote?: string;
}

interface QualityRun {
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

interface QualityFinding {
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
  priority: Priority;
  status: FindingStatus;
  cause: string | null;
  fixApplied: string | null;
  owner: string | null;
  identifiedAt: string;
  resolvedAt: string | null;
  retestResult: string | null;
}

const PRIORITY_META: Record<Priority, { label: string; className: string }> = {
  critical: { label: 'Crítica', className: 'bg-red-50 text-red-700 border-red-200' },
  high: { label: 'Alta', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  medium: { label: 'Média', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  low: { label: 'Baixa', className: 'bg-slate-50 text-slate-600 border-slate-200' },
};

const STATUS_META: Record<FindingStatus, { label: string; className: string }> = {
  identified: { label: 'Identificado', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  analyzing: { label: 'Em análise', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  fixing: { label: 'Em correção', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  fixed: { label: 'Corrigido', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  validating: { label: 'Em validação', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  resolved: { label: 'Resolvido', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  reopened: { label: 'Reaberto', className: 'bg-red-50 text-red-700 border-red-200' },
};

const STATUS_OPTIONS: FindingStatus[] = ['identified', 'analyzing', 'fixing', 'fixed', 'validating', 'resolved', 'reopened'];
const PRIORITY_OPTIONS: Priority[] = ['critical', 'high', 'medium', 'low'];

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-PT', {
    timeZone: 'Africa/Bissau',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCount(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('pt-PT') : '—';
}

function delta(value: number, previous: number): string {
  const difference = value - previous;
  if (difference === 0) return 'sem alteração';
  return `${difference > 0 ? '+' : ''}${difference}`;
}

export const AdminQualityAuditHub: React.FC = () => {
  const [runs, setRuns] = useState<QualityRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<{ run: QualityRun; findings: QualityFinding[] } | null>(null);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadRun = useCallback(async (id: string) => {
    if (!id) {
      setSelectedRun(null);
      return;
    }
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/admin/quality-audit/runs/${encodeURIComponent(id)}`, { credentials: 'include' });
      if (!response.ok) {
        setError(response.status === 503 ? 'Base de dados indisponível para a auditoria.' : 'Não foi possível carregar o relatório selecionado.');
        setSelectedRun(null);
        return;
      }
      const data = await response.json() as { run: QualityRun; findings: QualityFinding[] };
      setSelectedRun(data);
      setSelectedRunId(data.run.id);
    } catch {
      setError('Falha de rede ao carregar o relatório de auditoria.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadRuns = useCallback(async (preferredId?: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/quality-audit/runs?limit=30', { credentials: 'include' });
      if (!response.ok) {
        setError(response.status === 503 ? 'Base de dados indisponível para a auditoria.' : 'Não foi possível carregar as execuções de auditoria.');
        setRuns([]);
        setSelectedRun(null);
        return;
      }
      const data = await response.json() as { runs?: QualityRun[] };
      const nextRuns = Array.isArray(data.runs) ? data.runs : [];
      setRuns(nextRuns);
      const targetId = preferredId || selectedRunId || nextRuns[0]?.id;
      if (targetId) await loadRun(targetId);
    } catch {
      setError('Falha de rede ao carregar as execuções de auditoria.');
    } finally {
      setLoading(false);
    }
  }, [loadRun, selectedRunId]);

  useEffect(() => {
    void loadRuns();
    // A carga inicial deve acontecer uma única vez; atualizações são explícitas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRunChecks = async () => {
    setRunning(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/quality-audit/runs', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError((data as { error?: string }).error || 'Não foi possível executar as verificações automáticas.');
        return;
      }
      const data = await response.json() as { run: QualityRun };
      setMessage('Verificações automáticas concluídas e registadas.');
      await loadRuns(data.run.id);
    } catch {
      setError('Falha de rede ao executar as verificações.');
    } finally {
      setRunning(false);
    }
  };

  const handleStatusChange = async (finding: QualityFinding, status: FindingStatus) => {
    setUpdatingId(finding.id);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/admin/quality-audit/findings/${encodeURIComponent(finding.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError((data as { error?: string }).error || 'Não foi possível atualizar o estado do problema.');
        return;
      }
      setMessage(`Estado de ${finding.code} atualizado para ${STATUS_META[status].label}.`);
      await loadRun(finding.runId);
      const listResponse = await fetch('/api/admin/quality-audit/runs?limit=30', { credentials: 'include' });
      if (listResponse.ok) {
        const data = await listResponse.json() as { runs?: QualityRun[] };
        if (Array.isArray(data.runs)) setRuns(data.runs);
      }
    } catch {
      setError('Falha de rede ao atualizar o problema.');
    } finally {
      setUpdatingId(null);
    }
  };

  const findings = selectedRun?.findings || [];
  const filteredFindings = useMemo(() => {
    const query = search.trim().toLowerCase();
    return findings.filter((finding) => {
      const haystack = [
        finding.code,
        finding.title,
        finding.description,
        finding.module,
        finding.screen,
        finding.element,
        finding.cause,
        finding.fixApplied,
        finding.owner,
      ].filter(Boolean).join(' ').toLowerCase();
      return (!query || haystack.includes(query))
        && (moduleFilter === 'all' || finding.module === moduleFilter)
        && (priorityFilter === 'all' || finding.priority === priorityFilter)
        && (statusFilter === 'all' || finding.status === statusFilter);
    });
  }, [findings, moduleFilter, priorityFilter, search, statusFilter]);

  const modules = useMemo(
    () => Array.from(new Set(findings.map((finding) => finding.module))).sort((a, b) => a.localeCompare(b, 'pt')),
    [findings],
  );

  const selectedIndex = runs.findIndex((run) => run.id === selectedRun?.run.id);
  const previousRun = selectedIndex >= 0 ? runs[selectedIndex + 1] : undefined;
  const summary = selectedRun?.run.summary;

  const kpis = [
    { label: 'Telas analisadas', value: formatCount(summary?.screensTested), icon: Monitor, tone: 'text-blue-700 bg-blue-50' },
    { label: 'Botões testados', value: formatCount(summary?.buttonsTested), icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50' },
    { label: 'Formulários testados', value: formatCount(summary?.formsTested), icon: FileText, tone: 'text-purple-700 bg-purple-50' },
    { label: 'Funcionalidades', value: formatCount(summary?.featuresTested), icon: ClipboardCheck, tone: 'text-cyan-700 bg-cyan-50' },
    { label: 'Testes aprovados', value: formatCount(summary?.testsPassed), icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50' },
    { label: 'Testes reprovados', value: formatCount(summary?.testsFailed), icon: AlertTriangle, tone: 'text-red-700 bg-red-50' },
    { label: 'Problemas corrigidos', value: formatCount(selectedRun?.run.findingsResolved), icon: Wrench, tone: 'text-emerald-700 bg-emerald-50' },
    { label: 'Problemas pendentes', value: formatCount(selectedRun?.run.findingsPending), icon: Clock, tone: 'text-amber-700 bg-amber-50' },
    { label: 'Erros críticos', value: formatCount(selectedRun?.run.criticalOpen), icon: ShieldAlert, tone: 'text-red-700 bg-red-50' },
  ];

  const handleExportCSV = () => {
    if (!selectedRun) return;
    downloadCSV(
      `Guigui_Auditoria_Qualidade_${selectedRun.run.startedAt.slice(0, 10)}`,
      ['ID', 'Código', 'Módulo', 'Tela', 'Elemento', 'Problema', 'Prioridade', 'Estado', 'Causa', 'Correção', 'Responsável', 'Identificado em', 'Resolvido em', 'Reteste'],
      filteredFindings.map((finding) => [
        finding.id,
        finding.code,
        finding.module,
        finding.screen || '',
        finding.element || '',
        finding.title,
        PRIORITY_META[finding.priority].label,
        STATUS_META[finding.status].label,
        finding.cause || '',
        finding.fixApplied || '',
        finding.owner || '',
        formatDateTime(finding.identifiedAt),
        formatDateTime(finding.resolvedAt),
        finding.retestResult || '',
      ]),
    );
  };

  const handleExportPDF = () => {
    if (!selectedRun) return;
    downloadPDFReport(
      'Auditoria e Qualidade do Sistema',
      `Relatório da execução de ${formatDateTime(selectedRun.run.startedAt)}. ${selectedRun.run.notes || ''}`,
      [
        { label: 'Problemas', value: formatCount(selectedRun.run.findingsTotal) },
        { label: 'Corrigidos', value: formatCount(selectedRun.run.findingsResolved) },
        { label: 'Pendentes', value: formatCount(selectedRun.run.findingsPending) },
        { label: 'Críticos em aberto', value: formatCount(selectedRun.run.criticalOpen) },
      ],
      ['Código', 'Módulo', 'Problema', 'Prioridade', 'Estado', 'Causa', 'Correção', 'Reteste'],
      filteredFindings.map((finding) => [
        finding.code,
        finding.module,
        finding.title,
        PRIORITY_META[finding.priority].label,
        STATUS_META[finding.status].label,
        finding.cause || '—',
        finding.fixApplied || '—',
        finding.retestResult || '—',
      ]),
    );
  };

  return (
    <div className="space-y-4 text-xs">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-white shadow-sm sm:p-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-cyan-800 bg-cyan-950 px-3 py-1 text-[11px] font-bold text-cyan-300">
              <ClipboardCheck className="h-3.5 w-3.5" />
              Qualidade contínua baseada em execuções reais
            </div>
            <h2 className="text-2xl font-black sm:text-3xl">Auditoria e Qualidade do Sistema</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-300">
              Histórico de auditorias, verificações de base de dados, problemas, causas, correções e resultado dos retestes.
              Nenhum indicador é preenchido manualmente no painel.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadRuns()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 font-bold text-slate-100 transition hover:bg-slate-700 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
            <button
              type="button"
              onClick={() => void handleRunChecks()}
              disabled={running}
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 px-3 py-2.5 font-extrabold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-wait disabled:opacity-60"
            >
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
              Executar verificações
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={!selectedRun || filteredFindings.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2.5 font-bold text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={!selectedRun}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 font-bold text-slate-100 transition hover:bg-slate-700 disabled:opacity-50"
            >
              <Printer className="h-3.5 w-3.5 text-red-400" />
              PDF
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 font-semibold text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 font-semibold text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {message}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-black text-slate-900 dark:text-white">
              <History className="h-4 w-4 text-cyan-600" />
              Histórico de auditorias
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {loading ? 'A carregar execuções…' : `${runs.length} execução(ões) registada(s) na base de dados.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="quality-run-select" className="font-bold text-slate-600 dark:text-slate-300">Execução:</label>
            <select
              id="quality-run-select"
              value={selectedRunId}
              onChange={(event) => void loadRun(event.target.value)}
              className="min-w-56 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            >
              {runs.length === 0 && <option value="">Sem execuções</option>}
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {formatDateTime(run.startedAt)} · {run.findingsTotal} problema(s)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && !selectedRun ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-16 text-slate-500 dark:border-slate-700 dark:bg-slate-900">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          A carregar a auditoria de qualidade…
        </div>
      ) : !selectedRun ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-14 text-center dark:border-slate-700 dark:bg-slate-900">
          <Database className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <h3 className="text-sm font-black text-slate-800 dark:text-white">Ainda não existe uma auditoria registada</h3>
          <p className="mx-auto mt-1 max-w-lg text-slate-500">
            Execute as verificações automáticas para criar a primeira execução real. Os problemas encontrados devem ser registados com evidência e reteste.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Execução de {formatDateTime(selectedRun.run.startedAt)}
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {selectedRun.run.environment} · {selectedRun.run.triggeredBy} · {selectedRun.run.status === 'completed' ? 'concluída' : selectedRun.run.status}
                  {' · '}concluída em {formatDateTime(selectedRun.run.finishedAt)}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[10px] font-extrabold text-cyan-700">
                <Database className="h-3 w-3" />
                {selectedRun.run.checks.length} verificação(ões)
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {kpis.map(({ label, value, icon: Icon, tone }) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                  <div className={`mb-2 inline-flex h-7 w-7 items-center justify-center rounded-xl ${tone}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="font-mono text-lg font-black text-slate-900 dark:text-white">{value}</div>
                  <div className="mt-0.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">{label}</div>
                </div>
              ))}
            </div>
            {summary?.coverageNote && (
              <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-blue-800">
                {summary.coverageNote}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 lg:col-span-2">
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-black text-slate-900 dark:text-white">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Verificações automáticas
              </h3>
              {selectedRun.run.checks.length === 0 ? (
                <p className="text-slate-500">Esta execução não contém verificações automáticas.</p>
              ) : (
                <div className="space-y-2">
                  {selectedRun.run.checks.map((check) => (
                    <div key={check.id} className="flex flex-col justify-between gap-1 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700 sm:flex-row sm:items-center">
                      <div className="flex items-start gap-2">
                        {check.status === 'passed' ? (
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        ) : check.status === 'failed' ? (
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
                        ) : (
                          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                        )}
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-100">{check.name}</div>
                          <div className="text-[11px] text-slate-500">{check.detail}</div>
                        </div>
                      </div>
                      <span className={`self-start rounded-full px-2 py-0.5 text-[10px] font-extrabold sm:self-center ${
                        check.status === 'passed'
                          ? 'bg-emerald-50 text-emerald-700'
                          : check.status === 'failed'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-700'
                      }`}>
                        {check.status === 'passed' ? 'Aprovada' : check.status === 'failed' ? 'Reprovada' : 'Aviso'} · {check.durationMs} ms
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-black text-slate-900 dark:text-white">
                <History className="h-4 w-4 text-blue-600" />
                Comparação
              </h3>
              {previousRun ? (
                <div className="space-y-3">
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    Face à execução de {formatDateTime(previousRun.startedAt)}.
                  </p>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                    <div className="text-[10px] font-bold uppercase text-slate-500">Problemas pendentes</div>
                    <div className="font-mono text-lg font-black text-slate-900 dark:text-white">
                      {selectedRun.run.findingsPending}
                      <span className="ml-2 text-[11px] font-bold text-slate-500">
                        {delta(selectedRun.run.findingsPending, previousRun.findingsPending)}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                    <div className="text-[10px] font-bold uppercase text-slate-500">Críticos em aberto</div>
                    <div className="font-mono text-lg font-black text-slate-900 dark:text-white">
                      {selectedRun.run.criticalOpen}
                      <span className="ml-2 text-[11px] font-bold text-slate-500">
                        {delta(selectedRun.run.criticalOpen, previousRun.criticalOpen)}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                    <div className="text-[10px] font-bold uppercase text-slate-500">Verificações aprovadas</div>
                    <div className="font-mono text-lg font-black text-slate-900 dark:text-white">
                      {selectedRun.run.summary.checksPassed}
                      <span className="ml-2 text-[11px] font-bold text-slate-500">
                        {delta(selectedRun.run.summary.checksPassed, previousRun.summary.checksPassed)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] leading-relaxed text-slate-500">
                  É necessária pelo menos uma execução anterior para comparar indicadores.
                </p>
              )}
              {selectedRun.run.notes && <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-slate-800">{selectedRun.run.notes}</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800 lg:flex-row lg:items-center">
              <div>
                <h3 className="flex items-center gap-1.5 text-sm font-black text-slate-900 dark:text-white">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  Relatório detalhado de problemas
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {filteredFindings.length} de {findings.length} problema(s) visíveis.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <label className="relative block">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Pesquisar problema…"
                    aria-label="Pesquisar problemas"
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-8 pr-2 text-xs font-semibold text-slate-900 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  />
                </label>
                <select
                  value={moduleFilter}
                  onChange={(event) => setModuleFilter(event.target.value)}
                  aria-label="Filtrar por módulo"
                  className="rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs font-bold text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                >
                  <option value="all">Todos os módulos</option>
                  {modules.map((module) => <option key={module} value={module}>{module}</option>)}
                </select>
                <select
                  value={priorityFilter}
                  onChange={(event) => setPriorityFilter(event.target.value)}
                  aria-label="Filtrar por prioridade"
                  className="rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs font-bold text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                >
                  <option value="all">Todas as prioridades</option>
                  {PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{PRIORITY_META[priority].label}</option>)}
                </select>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  aria-label="Filtrar por estado"
                  className="rounded-xl border border-slate-300 bg-white px-2 py-2 text-xs font-bold text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                >
                  <option value="all">Todos os estados</option>
                  {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{STATUS_META[status].label}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {detailLoading && (
                <div className="flex items-center justify-center py-6 text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />A carregar detalhe…</div>
              )}
              {!detailLoading && filteredFindings.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-slate-500 dark:border-slate-700">
                  Nenhum problema corresponde aos filtros selecionados.
                </div>
              )}
              {!detailLoading && filteredFindings.map((finding) => {
                const expanded = expandedId === finding.id;
                const priority = PRIORITY_META[finding.priority];
                const status = STATUS_META[finding.status];
                return (
                  <article key={finding.id} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : finding.id)}
                      aria-expanded={expanded}
                      className="flex w-full flex-col justify-between gap-2 px-3 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[10px] font-black text-slate-500">{finding.code}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${priority.className}`}>{priority.label}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${status.className}`}>{status.label}</span>
                        </div>
                        <h4 className="mt-1 text-xs font-black text-slate-900 dark:text-white">{finding.title}</h4>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">
                          {finding.module}{finding.screen ? ` · ${finding.screen}` : ''}{finding.element ? ` · ${finding.element}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-[10px] font-semibold text-slate-400">{formatDateTime(finding.identifiedAt)}</span>
                        {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                      </div>
                    </button>

                    {expanded && (
                      <div className="border-t border-slate-100 px-3 py-3 dark:border-slate-800">
                        <p className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">{finding.description}</p>
                        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {[
                            ['Passos para reproduzir', finding.steps],
                            ['Resultado esperado', finding.expectedResult],
                            ['Resultado obtido', finding.actualResult],
                            ['Causa identificada', finding.cause],
                            ['Correção aplicada', finding.fixApplied],
                            ['Responsável', finding.owner],
                            ['Resultado do reteste', finding.retestResult],
                            ['Resolvido em', finding.resolvedAt ? formatDateTime(finding.resolvedAt) : null],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                              <dt className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">{label}</dt>
                              <dd className="mt-0.5 whitespace-pre-line break-words text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                                {value || '—'}
                              </dd>
                            </div>
                          ))}
                        </dl>
                        <div className="mt-3 flex flex-col justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 sm:flex-row sm:items-center">
                          <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                            <Filter className="h-3 w-3" />
                            Atualizar estado com registo persistente
                          </span>
                          <div className="flex items-center gap-2">
                            {updatingId === finding.id && <Loader2 className="h-4 w-4 animate-spin text-cyan-600" />}
                            <select
                              value={finding.status}
                              onChange={(event) => void handleStatusChange(finding, event.target.value as FindingStatus)}
                              disabled={updatingId === finding.id}
                              aria-label={`Estado de ${finding.code}`}
                              className="rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                            >
                              {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{STATUS_META[option].label}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
