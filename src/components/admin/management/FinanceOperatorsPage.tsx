import React, { useEffect, useState } from 'react';
import { Settings, Smartphone } from 'lucide-react';
import { ManagementActionButton, ManagementKpiGrid, ManagementPage } from './ManagementUi';
import { FinanceField, FinanceLoading, FinanceMessage, FinanceModal, financeInputClass } from './FinanceShared';
import {
  financeFetch,
  financeStatusTone,
  formatFinanceDateTime,
  formatXOF,
  type FinanceOperator,
  type FinanceOperatorHistory,
} from './financeApi';

interface Props { onBack: () => void }

interface OperatorResponse {
  providers: FinanceOperator[];
  history: FinanceOperatorHistory[];
}

const INTEGRATION_LABELS: Record<FinanceOperator['integrationStatus'], string> = {
  negotiation: 'Integração em negociação',
  sandbox: 'Sandbox',
  production: 'Produção',
  manual: 'Operação manual',
};

export const FinanceOperatorsPage: React.FC<Props> = ({ onBack }) => {
  const [data, setData] = useState<OperatorResponse>({ providers: [], history: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [editing, setEditing] = useState<FinanceOperator | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    dedicatedPhone: '',
    integrationStatus: 'negotiation' as FinanceOperator['integrationStatus'],
    apiBaseUrl: '',
    webhookPath: '',
    apiVersion: '',
    supportsAutoPushOtp: false,
    notes: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      setData(await financeFetch<OperatorResponse>('/api/admin/finance/operators'));
    } catch (reason) {
      setMessage({ tone: 'error', text: (reason as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const openEdit = (operator: FinanceOperator) => {
    setEditing(operator);
    setForm({
      dedicatedPhone: operator.dedicatedPhone || '',
      integrationStatus: operator.integrationStatus,
      apiBaseUrl: operator.apiBaseUrl || '',
      webhookPath: operator.webhookPath || '',
      apiVersion: operator.apiVersion || '',
      supportsAutoPushOtp: operator.supportsAutoPushOtp,
      notes: operator.notes || '',
    });
    setMessage(null);
  };

  const submit = async () => {
    if (!editing) return;
    setSaving(true);
    setMessage(null);
    try {
      await financeFetch(`/api/admin/finance/operators/${encodeURIComponent(editing.provider)}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...form, reason: 'Configuração administrativa da operadora' }),
      });
      setEditing(null);
      await load();
      setMessage({ tone: 'success', text: 'Configuração da operadora atualizada e registada na auditoria.' });
    } catch (reason) {
      setMessage({ tone: 'error', text: (reason as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const totalVolume = data.providers.reduce((sum, item) => sum + item.volumeXOF, 0);
  const totalTransactions = data.providers.reduce((sum, item) => sum + item.transactionCount, 0);
  const totalPending = data.providers.reduce((sum, item) => sum + item.pendingCount, 0);

  return (
    <ManagementPage
      title="Operadoras"
      description="Gestão individual de Orange Money e Telecel. Cada operadora tem identificação, número dedicado, volume real, pendentes, estado da integração, configurações e informação técnica."
      moduleLabel="Financeiro"
      onBack={onBack}
      breadcrumbTail="Operadoras"
      kpis={[
        { label: 'Operadoras geridas', value: data.providers.length, tone: 'info' },
        { label: 'Volume registado', value: formatXOF(totalVolume), tone: 'neutral' },
        { label: 'Transações da plataforma', value: totalTransactions, tone: 'neutral' },
        { label: 'Pagamentos pendentes', value: totalPending, tone: 'warning' },
      ]}
    >
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-relaxed text-amber-900">
        <strong className="font-black">Integração em fases:</strong> negociação, sandbox, produção e operação manual são estados distintos.
        Nenhuma credencial ou chave secreta é guardada ou apresentada nesta área; apenas dados técnicos de configuração.
      </div>

      {message && <FinanceMessage tone={message.tone}>{message.text}</FinanceMessage>}
      {loading ? <FinanceLoading /> : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {data.providers.map((operator) => (
            <section key={operator.provider} className="flex flex-col gap-3 rounded-2xl border border-[#e6dac8] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f3faf8] text-[#123e3b]"><Smartphone className="h-4 w-4" /></span>
                  <div>
                    <h3 className="text-[13px] font-black text-slate-900">{operator.label}</h3>
                    <span className="text-[9.5px] font-mono text-slate-500">{operator.provider}</span>
                  </div>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[8.5px] font-black ${financeStatusTone(operator.integrationStatus === 'production' ? 'processed' : operator.integrationStatus)}`}>
                  {INTEGRATION_LABELS[operator.integrationStatus]}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-2"><span className="block font-black text-slate-500">Número dedicado</span>{operator.dedicatedPhone || '—'}</div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-2"><span className="block font-black text-slate-500">Volume registado</span>{formatXOF(operator.volumeXOF)}</div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-2"><span className="block font-black text-slate-500">Transações</span>{operator.transactionCount}</div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-2"><span className="block font-black text-slate-500">Pendentes</span>{operator.pendingCount} · {formatXOF(operator.pendingXOF)}</div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-2"><span className="block font-black text-slate-500">Confirmado real</span>{formatXOF(operator.confirmedXOF)}</div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-2"><span className="block font-black text-slate-500">Sandbox/simulado</span>{operator.simulatedCount} registos</div>
              </div>
              <div className="space-y-1 rounded-xl border border-slate-100 p-2.5 text-[9.5px] text-slate-600">
                <div><strong>API:</strong> {operator.apiBaseUrl || 'Ainda não configurada'}</div>
                <div><strong>Webhook:</strong> {operator.webhookPath || '—'} · versão {operator.apiVersion || '—'}</div>
                <div><strong>OTP automático:</strong> {operator.supportsAutoPushOtp ? 'Sim' : 'Não'}</div>
                {operator.notes && <div className="text-slate-500">{operator.notes}</div>}
                <div className="text-[8.5px] text-slate-400">Atualizado {formatFinanceDateTime(operator.updatedAt)}</div>
              </div>
              <ManagementActionButton onClick={() => openEdit(operator)}><Settings className="h-3.5 w-3.5" /> Configurar {operator.label}</ManagementActionButton>
            </section>
          ))}
        </div>
      )}

      <section className="space-y-2 rounded-2xl border border-[#e6dac8] bg-white p-4 shadow-sm">
        <h3 className="text-[12px] font-black text-slate-900">Histórico de configurações</h3>
        {data.history.length === 0 ? <p className="text-[10px] text-slate-500">Sem alterações de configuração registadas.</p> : (
          <div className="max-h-64 overflow-auto">
            <table className="w-full min-w-[600px] text-left text-[10px]">
              <thead className="sticky top-0 bg-[#f7f2ec] text-[8.5px] font-black uppercase tracking-[0.12em] text-slate-500">
                <tr><th className="px-2 py-2">Operação</th><th className="px-2 py-2">Operadora</th><th className="px-2 py-2">Responsável</th><th className="px-2 py-2">Data</th></tr>
              </thead>
              <tbody>
                {data.history.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-2 py-2 font-bold capitalize">{item.actionLabel}</td>
                    <td className="px-2 py-2">{item.provider || '—'}</td>
                    <td className="px-2 py-2">{item.actorName}</td>
                    <td className="px-2 py-2">{formatFinanceDateTime(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <FinanceModal
        open={Boolean(editing)}
        title={editing ? `Configurar ${editing.label}` : 'Configurar operadora'}
        description="Apenas configuração operacional. Nunca introduza chaves secretas, tokens ou palavras-passe neste formulário."
        onClose={() => setEditing(null)}
        footer={(
          <>
            <ManagementActionButton onClick={() => setEditing(null)}>Cancelar</ManagementActionButton>
            <ManagementActionButton tone="primary" disabled={saving} onClick={() => void submit()}>{saving ? 'A guardar…' : 'Guardar configuração'}</ManagementActionButton>
          </>
        )}
      >
        {editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FinanceField label="Número dedicado">
                <input value={form.dedicatedPhone} onChange={(event) => setForm((current) => ({ ...current, dedicatedPhone: event.target.value }))} className={financeInputClass} placeholder="+245 955 00 00" />
              </FinanceField>
              <FinanceField label="Estado da integração">
                <select value={form.integrationStatus} onChange={(event) => setForm((current) => ({ ...current, integrationStatus: event.target.value as FinanceOperator['integrationStatus'] }))} className={financeInputClass}>
                  <option value="negotiation">Integração em negociação</option>
                  <option value="sandbox">Sandbox</option>
                  <option value="production">Produção</option>
                  <option value="manual">Operação manual</option>
                </select>
              </FinanceField>
            </div>
            <FinanceField label="URL base da API" hint="Não inclua credenciais no URL.">
              <input value={form.apiBaseUrl} onChange={(event) => setForm((current) => ({ ...current, apiBaseUrl: event.target.value }))} className={financeInputClass} placeholder="https://api.operadora.example" />
            </FinanceField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FinanceField label="Caminho do webhook">
                <input value={form.webhookPath} onChange={(event) => setForm((current) => ({ ...current, webhookPath: event.target.value }))} className={financeInputClass} placeholder="/api/payments/webhook/orange_money" />
              </FinanceField>
              <FinanceField label="Versão da API">
                <input value={form.apiVersion} onChange={(event) => setForm((current) => ({ ...current, apiVersion: event.target.value }))} className={financeInputClass} placeholder="v1" />
              </FinanceField>
            </div>
            <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
              <input type="checkbox" checked={form.supportsAutoPushOtp} onChange={(event) => setForm((current) => ({ ...current, supportsAutoPushOtp: event.target.checked }))} />
              Suporta envio automático de OTP
            </label>
            <FinanceField label="Notas operacionais">
              <textarea rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className={financeInputClass} />
            </FinanceField>
          </div>
        )}
      </FinanceModal>
    </ManagementPage>
  );
};
