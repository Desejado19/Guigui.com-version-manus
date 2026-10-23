import React, { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Printer,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Info,
  Search,
  Filter,
  Clock,
  User,
  Monitor,
  Globe,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Eye,
  Building2,
  Sparkles,
  CreditCard,
  KeyRound,
} from 'lucide-react';
import { AuditLogEntry, AuditLogCategory, AuditSeverity, Language } from '../../types';
import { downloadCSV, downloadExcel, downloadPDFReport } from '../../utils/exportHelpers';
import { getTranslation } from '../../utils/i18n';

interface AdminAuditLogsHubProps {
  logs: AuditLogEntry[];
  onRefreshLogs?: () => void;
  currentLang: Language;
}

export const AdminAuditLogsHub: React.FC<AdminAuditLogsHubProps> = ({
  logs,
  onRefreshLogs,
  currentLang,
}) => {
  const t = (key: string, variables?: Record<string, string | number>) => getTranslation(currentLang, key, variables);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const searchableLogText = [
      log.actorName,
      log.actionLabel,
      log.targetEntity,
      log.details,
      log.ipAddress,
      log.id,
    ].filter(Boolean).join(' ').toLowerCase();
    const matchSearch = searchableLogText.includes(searchQuery.toLowerCase());

    const matchCategory =
      selectedCategory === 'all' || log.category === selectedCategory;

    const matchSeverity =
      selectedSeverity === 'all' || log.severity === selectedSeverity;

    return matchSearch && matchCategory && matchSeverity;
  });

  const getSeverityBadge = (severity: AuditSeverity) => {
    switch (severity) {
      case 'info':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Informativo
          </span>
        );
      case 'warning':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Aviso
          </span>
        );
      case 'critical':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" />
            Crítico
          </span>
        );
      case 'security':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            Segurança
          </span>
        );
    }
  };

  const getCategoryIcon = (category: AuditLogCategory) => {
    switch (category) {
      case 'business':
        return <Building2 className="w-3.5 h-3.5 text-blue-600" />;
      case 'moderation':
        return <Sparkles className="w-3.5 h-3.5 text-amber-500" />;
      case 'financial':
        return <CreditCard className="w-3.5 h-3.5 text-emerald-600" />;
      case 'admin_management':
        return <KeyRound className="w-3.5 h-3.5 text-purple-600" />;
      default:
        return <Shield className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  // Export functions
  const handleExportCSV = () => {
    const headers = [
      'ID Log',
      'Data e Hora (Bissau)',
      'Autor da Ação',
      'Perfil / Cargo',
      'Ação Executada',
      'Categoria',
      'Severidade',
      'Entidade Alvo',
      'Endereço IP',
      'Dispositivo / Browser',
      'Detalhes da Operação',
    ];

    const rows = filteredLogs.map((log) => [
      log.id,
      log.timestamp,
      log.actorName,
      log.actorRole,
      log.actionLabel,
      log.category.toUpperCase(),
      log.severity.toUpperCase(),
      log.targetEntity,
      log.ipAddress,
      log.deviceInfo,
      log.details,
    ]);

    downloadCSV(`Guigui_Logs_Auditoria_${new Date().toISOString().substring(0, 10)}`, headers, rows);
  };

  const handleExportExcel = () => {
    const headers = [
      'ID Log',
      'Data e Hora (Bissau)',
      'Autor da Ação',
      'Perfil / Cargo',
      'Ação Executada',
      'Categoria',
      'Severidade',
      'Entidade Alvo',
      'Endereço IP',
      'Dispositivo / Browser',
      'Detalhes da Operação',
    ];

    const rows = filteredLogs.map((log) => [
      log.id,
      log.timestamp,
      log.actorName,
      log.actorRole,
      log.actionLabel,
      log.category.toUpperCase(),
      log.severity.toUpperCase(),
      log.targetEntity,
      log.ipAddress,
      log.deviceInfo,
      log.details,
    ]);

    downloadExcel(
      `Guigui_Logs_Auditoria_${new Date().toISOString().substring(0, 10)}`,
      'Auditoria de Operações',
      headers,
      rows
    );
  };

  const handleExportPDF = () => {
    const headers = ['ID', 'Data/Hora', 'Autor', 'Ação Realizada', 'Alvo', 'Severidade', 'IP'];
    const rows = filteredLogs.map((log) => [
      log.id,
      log.timestamp,
      log.actorName,
      log.actionLabel,
      log.targetEntity,
      log.severity.toUpperCase(),
      log.ipAddress,
    ]);

    const title = 'Relatório Oficial de Logs de Auditoria e Segurança';
    const summary = `Extrato cronológico e rastreável de todas as ações administrativas, moderação de conteúdos, movimentações financeiras e acessos à plataforma Guigui.com. Registos filtrados: ${filteredLogs.length}.`;

    const kpis = [
      { label: 'Total de Registos', value: `${filteredLogs.length}` },
      {
        label: 'Ações de Segurança',
        value: `${filteredLogs.filter((l) => l.severity === 'security').length}`,
      },
      {
        label: 'Operações Financeiras',
        value: `${filteredLogs.filter((l) => l.category === 'financial').length}`,
      },
      {
        label: 'Moderações IA',
        value: `${filteredLogs.filter((l) => l.category === 'moderation').length}`,
      },
    ];

    downloadPDFReport(title, summary, kpis, headers, rows);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-md">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-blue-950 text-blue-300 text-xs px-3 py-1 rounded-full border border-blue-800 font-bold mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>{t('admin.auditBanner')}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black">
            {t('admin.auditTitle')}
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Rastreio imutável de todas as acções críticas do portal. As alterações do Super Admin são gravadas no perfil desta instalação, podem ser filtradas e exportadas sem expor operações de bilhetes.
          </p>
        </div>

        {/* Quick Export Actions */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {onRefreshLogs && (
            <button type="button"
              onClick={onRefreshLogs}
              className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-md"
              title="Recarregar logs persistidos"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t('retry')}</span>
            </button>
          )}
          <button type="button"
            onClick={handleExportPDF}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs rounded-xl border border-slate-700 transition flex items-center gap-1.5"
            title="Exportar Relatório PDF"
          >
            <Printer className="w-3.5 h-3.5 text-red-400" />
            <span>PDF</span>
          </button>

          <button type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs rounded-xl border border-slate-700 transition flex items-center gap-1.5"
            title="Exportar Folha de Cálculo Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Excel</span>
          </button>

          <button type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-1.5 shadow-md"
            title="Descarregar Ficheiro CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Total de Logs Registados
          </div>
          <div className="text-2xl font-black tabular-nums text-[var(--color-text-strong)] mt-1">
            {logs.length}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Rastreamento 24/7</div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Moderações de Conteúdo
          </div>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {logs.filter((l) => l.category === 'moderation').length}
          </div>
          <div className="text-[10px] text-amber-600 mt-0.5">IA Gemini & Humano</div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Ações Financeiras
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {logs.filter((l) => l.category === 'financial').length}
          </div>
          <div className="text-[10px] text-emerald-600 mt-0.5">Orange Money / Preços</div>
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] p-4">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Acessos & Segurança
          </div>
          <div className="text-2xl font-black text-purple-600 mt-1">
            {logs.filter((l) => l.category === 'admin_management' || l.severity === 'security').length}
          </div>
          <div className="text-[10px] text-purple-600 mt-0.5">Gestão de credenciais</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] flex flex-col md:flex-row items-center justify-between gap-3 p-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('admin.auditSearch')}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="all">{t('admin.allCategories')}</option>
            <option value="business">Negócios & Perfis</option>
            <option value="moderation">Moderação de Conteúdo</option>
            <option value="financial">Finanças & Pagamentos</option>
            <option value="admin_management">Gestão de Administradores</option>
            <option value="security">Segurança & Acessos</option>
          </select>

          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="all">{t('admin.allSeverities')}</option>
            <option value="info">Informativo</option>
            <option value="warning">Aviso</option>
            <option value="critical">Crítico</option>
            <option value="security">Segurança</option>
          </select>

          {onRefreshLogs && (
            <button type="button"
              onClick={onRefreshLogs}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
              title="Atualizar Logs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-extrabold uppercase text-[10px]">
                <th className="py-3.5 px-4">Data / Hora (Bissau)</th>
                <th className="py-3.5 px-4">Autor da Operação</th>
                <th className="py-3.5 px-4">Ação Realizada</th>
                <th className="py-3.5 px-4">Entidade Alvo</th>
                <th className="py-3.5 px-4">Severidade</th>
                <th className="py-3.5 px-4">Endereço IP</th>
                <th className="py-3.5 px-4 text-right">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    {t('admin.auditEmpty')}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className={`hover:bg-slate-50/80 transition cursor-pointer ${
                          isExpanded ? 'bg-slate-50' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{log.timestamp}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-slate-900">{log.actorName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {log.actorRole}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            {getCategoryIcon(log.category)}
                            <span>{log.actionLabel}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-medium text-slate-700">
                          <span className="bg-slate-100 px-2 py-0.5 rounded-lg text-[11px] font-mono">
                            {log.targetEntity}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">{getSeverityBadge(log.severity)}</td>

                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                          <div className="flex items-center gap-1">
                            <Globe className="w-3 h-3 text-slate-400" />
                            <span>{log.ipAddress}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Detail Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 border-b border-slate-200">
                          <td colSpan={7} className="p-4">
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
                              <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                                <div className="font-bold text-slate-700 flex items-center gap-2">
                                  <span>ID do Registo:</span>
                                  <code className="bg-slate-100 px-2 py-0.5 rounded text-emerald-700 font-bold font-mono">
                                    {log.id}
                                  </code>
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                  <Monitor className="w-3 h-3" />
                                  <span>{log.deviceInfo}</span>
                                </div>
                              </div>

                              <div>
                                <div className="text-[10px] font-extrabold uppercase text-slate-400 mb-1">
                                  Descrição & Justificação da Operação:
                                </div>
                                <p className="text-xs text-slate-800 leading-relaxed font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                  {log.details}
                                </p>
                              </div>

                              {log.changes && log.changes.length > 0 && (
                                <div>
                                  <div className="text-[10px] font-extrabold uppercase text-slate-400 mb-1.5">
                                    Payload & Alterações Detectadas (Diff):
                                  </div>
                                  <div className="space-y-1.5">
                                    {log.changes.map((ch, idx) => (
                                      <div
                                        key={idx}
                                        className="text-[11px] p-2 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2"
                                      >
                                        <span className="font-bold text-slate-700">
                                          {ch.fieldLabel} ({ch.field}):
                                        </span>
                                        <div className="flex items-center gap-2 font-mono text-[11px]">
                                          <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded line-through border border-red-200">
                                            {String(ch.oldValue ?? 'vazio')}
                                          </span>
                                          <span className="text-slate-400">➔</span>
                                          <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200">
                                            {String(ch.newValue ?? 'vazio')}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
