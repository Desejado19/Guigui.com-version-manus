import React, { useEffect, useMemo, useState } from 'react';
import { BadgePercent, Calculator, Edit2, Plus } from 'lucide-react';
import {
  ManagementActionButton,
  ManagementFilter,
  type ManagementKpi,
} from './ManagementUi';
import {
  CommercialField,
  CommercialLoading,
  CommercialMessage,
  CommercialModal,
  CommercialPageShell,
  commercialInputClass,
} from './CommercialShared';
import {
  commercialRequest,
  formatCommercialDate,
  formatCommercialXOF,
  type CommercialMatrixCell,
  type CommercialOverview,
} from './commercialApi';

type CellDraft = {
  groupId: string;
  groupName: string;
  planId: string;
  planName: string;
  monthlyXOF: number;
  discountPercent: number;
  isActive: boolean;
};

export const CommercialPricingPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [overview, setOverview] = useState<CommercialOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<CellDraft | null>(null);
  const [reason, setReason] = useState('');
  const [groupDraft, setGroupDraft] = useState<{ name: string; code: string; description: string } | null>(null);
  const [simGroup, setSimGroup] = useState('');
  const [simPlan, setSimPlan] = useState('');
  const [simPeriod, setSimPeriod] = useState('monthly');

  const load = async () => {
    setLoading(true);
    try {
      const data = await commercialRequest<CommercialOverview>('/api/admin/commercial/overview');
      setOverview(data);
      setSimGroup((current) => current || data.groups[0]?.id || '');
      setSimPlan((current) => current || data.plans.find((plan) => plan.isActive)?.id || '');
      setError('');
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const plans = overview?.plans.filter((plan) => plan.isActive || overview.matrix.some((cell) => cell.planId === plan.id)) || [];
  const groups = overview?.groups || [];
  const cellFor = (groupId: string, planId: string) => overview?.matrix.find((cell) => cell.groupId === groupId && cell.planId === planId);
  const activeCells = overview?.matrix.filter((cell) => cell.isActive) || [];
  const averageDiscount = activeCells.length ? activeCells.reduce((sum, cell) => sum + cell.discountPercent, 0) / activeCells.length : 0;
  const kpis: ManagementKpi[] = [
    { label: 'Combinações de preço', value: overview?.matrix.length ?? 0, hint: `${groups.length} grupos × ${plans.length} planos`, tone: 'info' },
    { label: 'Células ativas', value: activeCells.length, hint: 'Preço aplicável a novas adesões', tone: 'success' },
    { label: 'Desconto anual médio', value: `${averageDiscount.toFixed(1)}%`, hint: `Regra base: ${overview?.rules?.annualDiscountPercent ?? 15}%`, tone: 'warning' },
    { label: 'Versão do catálogo', value: `v${overview?.summary?.catalogVersion ?? '—'}`, hint: 'Histórico preservado', tone: 'neutral' },
  ];

  const simulated = useMemo(() => {
    const cell = cellFor(simGroup, simPlan);
    if (!cell) return null;
    return { ...cell, value: simPeriod === 'annual' ? cell.annualXOF : cell.monthlyXOF };
  }, [overview, simGroup, simPlan, simPeriod]);

  const saveCell = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      await commercialRequest(`/api/admin/commercial/matrix/${encodeURIComponent(draft.groupId)}/${encodeURIComponent(draft.planId)}`, {
        method: 'PUT',
        body: JSON.stringify({ monthlyXOF: draft.monthlyXOF, discountPercent: draft.discountPercent, isActive: draft.isActive, reason: reason || 'Alteração da matriz de preços' }),
      });
      setDraft(null);
      setReason('');
      setNotice('Preço atualizado. Assinaturas existentes mantêm o valor contratado; novas adesões e renovações usam este valor.');
      await load();
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const createGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!groupDraft) return;
    setBusy(true);
    try {
      await commercialRequest('/api/admin/commercial/price-groups', { method: 'POST', body: JSON.stringify({ ...groupDraft, reason: reason || 'Criação de grupo de categorias' }) });
      setGroupDraft(null);
      setReason('');
      setNotice('Grupo de categorias criado com uma célula de preço por plano.');
      await load();
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const annualFromForm = draft ? Math.round(draft.monthlyXOF * 12 * (1 - draft.discountPercent / 100)) : 0;

  return (
    <CommercialPageShell
      title="Matriz de Preços"
      description="Fonte oficial do preço por grupo de categoria e plano. Os preços mensais e anuais são configuráveis; as alterações aplicam-se a novas adesões e renovações."
      onBack={onBack}
      breadcrumb="Matriz de Preços"
      kpis={kpis}
      actions={<ManagementActionButton tone="primary" onClick={() => { setGroupDraft({ name: '', code: '', description: '' }); setReason(''); }}><Plus className="h-3.5 w-3.5" /> Novo grupo</ManagementActionButton>}
    >
      {error && <CommercialMessage tone="error">{error}</CommercialMessage>}
      {notice && <CommercialMessage tone="success">{notice}</CommercialMessage>}
      {loading ? <CommercialLoading /> : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-[#e6dac8] bg-white shadow-sm">
            <table className="w-full min-w-[1080px] border-collapse text-left text-[10.5px]">
              <thead><tr className="bg-[#f7f2ec] text-[9px] uppercase tracking-[0.12em] text-slate-500"><th className="border-b border-[#e6dac8] p-3">Grupo de categoria</th>{plans.map((plan) => <th key={plan.id} className="border-b border-[#e6dac8] p-3 text-center">{plan.name}<div className="text-[8px] font-medium normal-case text-slate-400">referência {formatCommercialXOF(plan.priceXOF)}</div></th>)}</tr></thead>
              <tbody>
                {groups.map((group) => <tr key={group.id} className="border-b border-slate-100 align-top last:border-0"><td className="p-3"><div className="font-black text-slate-900">{group.name}</div><div className="mt-0.5 max-w-[260px] text-[9px] text-slate-500">{group.description || 'Sem descrição'}</div></td>{plans.map((plan) => {
                  const cell = cellFor(group.id, plan.id);
                  return <td key={plan.id} className="p-2 text-center">
                    {cell ? <button type="button" aria-label={`Editar preço ${group.name} ${plan.name}`} onClick={() => { setDraft({ groupId: group.id, groupName: group.name, planId: plan.id, planName: plan.name, monthlyXOF: cell.monthlyXOF, discountPercent: cell.discountPercent, isActive: cell.isActive }); setReason(''); }} className={`group w-full rounded-xl border p-2.5 text-left transition hover:border-[#123e3b] ${cell.isActive ? 'border-[#e6dac8] bg-white' : 'border-slate-200 bg-slate-50 opacity-70'}`}>
                      <div className="font-black text-slate-900">{formatCommercialXOF(cell.monthlyXOF)} <Edit2 className="inline h-3 w-3 text-slate-300 group-hover:text-[#123e3b]" /></div>
                      <div className="mt-0.5 text-[9px] text-slate-500">Anual {formatCommercialXOF(cell.annualXOF)}</div>
                      <div className="mt-1 flex items-center justify-between text-[8.5px]"><span className="rounded-full bg-emerald-50 px-1.5 py-0.5 font-black text-emerald-800">{cell.discountPercent}% desc.</span><span className={`font-black ${cell.isActive ? 'text-emerald-700' : 'text-slate-500'}`}>{cell.isActive ? 'Ativa' : 'Inativa'}</span></div>
                    </button> : <span className="text-slate-400">Sem preço</span>}
                  </td>;
                })}</tr>)}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <section className="rounded-2xl border border-[#cfe2df] bg-[#f3faf8] p-4 shadow-sm">
              <h3 className="flex items-center gap-2 text-[12px] font-black text-[#123e3b]"><Calculator className="h-4 w-4" /> Simulador de preço</h3>
              <p className="mt-1 text-[10px] text-slate-600">Calculado exclusivamente no backend a partir da matriz ativa.</p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <ManagementFilter label="Categoria" value={simGroup} onChange={setSimGroup} options={groups.map((group) => ({ value: group.id, label: group.name }))} />
                <ManagementFilter label="Plano" value={simPlan} onChange={setSimPlan} options={plans.map((plan) => ({ value: plan.id, label: plan.name }))} />
                <ManagementFilter label="Período" value={simPeriod} onChange={setSimPeriod} options={[{ value: 'monthly', label: 'Mensal' }, { value: 'annual', label: 'Anual' }]} />
              </div>
              <div className="mt-3 rounded-xl border border-white bg-white/80 p-3"><div className="text-[9px] font-black uppercase text-slate-500">Preço calculado</div><div className="mt-1 text-xl font-black text-[#123e3b]">{simulated ? formatCommercialXOF(simulated.value) : 'Sem combinação ativa'}</div>{simulated && <div className="text-[9.5px] text-slate-500">Mensal {formatCommercialXOF(simulated.monthlyXOF)} · anual {formatCommercialXOF(simulated.annualXOF)} · {simulated.discountPercent}%</div>}</div>
            </section>
            <section className="rounded-2xl border border-[#e6dac8] bg-white p-4 shadow-sm">
              <h3 className="flex items-center gap-2 text-[12px] font-black text-slate-900"><BadgePercent className="h-4 w-4" /> Regras de aplicação</h3>
              <ul className="mt-2 space-y-1.5 text-[10px] leading-relaxed text-slate-600">
                <li>• A matriz prevalece sobre o preço de referência do catálogo quando existe uma combinação ativa.</li>
                <li>• Alterações não reescrevem assinaturas já pagas; aplicam-se a novas adesões e renovações.</li>
                <li>• O desconto anual configurado é {overview?.rules?.annualDiscountPercent ?? 15}%; cada célula pode ter o seu próprio desconto.</li>
                <li>• O histórico guarda valor anterior, novo valor, responsável, motivo e versão.</li>
              </ul>
              {overview?.recentAudit.some((item) => item.entityType === 'price_matrix') && <div className="mt-3 border-t border-slate-100 pt-2 text-[9.5px] text-slate-500">Última alteração: {formatCommercialDate(overview.recentAudit.find((item) => item.entityType === 'price_matrix')?.createdAt || null, true)}</div>}
            </section>
          </div>
        </>
      )}

      <CommercialModal open={Boolean(draft)} title={`Preço — ${draft?.groupName || ''} / ${draft?.planName || ''}`} description="O preço anual é calculado a partir do mensal e do desconto. Zero é permitido para condições negociadas." onClose={() => setDraft(null)}
        footer={<><ManagementActionButton onClick={() => setDraft(null)}>Cancelar</ManagementActionButton><ManagementActionButton tone="primary" disabled={busy} onClick={() => void saveCell()}>{busy ? 'A guardar…' : 'Guardar preço'}</ManagementActionButton></>}
      >
        {draft && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CommercialField label="Preço mensal (XOF)"><input type="number" min={0} className={commercialInputClass} value={draft.monthlyXOF} onChange={(event) => setDraft({ ...draft, monthlyXOF: Math.max(0, Number(event.target.value) || 0) })} /></CommercialField>
          <CommercialField label="Desconto anual (%)"><input type="number" min={0} max={100} step={0.5} className={commercialInputClass} value={draft.discountPercent} onChange={(event) => setDraft({ ...draft, discountPercent: Math.min(100, Math.max(0, Number(event.target.value) || 0)) })} /></CommercialField>
          <CommercialField label="Preço anual calculado (XOF)" hint="12 mensalidades com o desconto indicado."><input readOnly className={commercialInputClass} value={annualFromForm} /></CommercialField>
          <CommercialField label="Estado"><select className={commercialInputClass} value={draft.isActive ? 'active' : 'inactive'} onChange={(event) => setDraft({ ...draft, isActive: event.target.value === 'active' })}><option value="active">Ativa</option><option value="inactive">Inativa</option></select></CommercialField>
          <CommercialField label="Motivo" className="sm:col-span-2"><input className={commercialInputClass} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Obrigatório para o histórico? Opcional, mas recomendado." /></CommercialField>
          <div className="sm:col-span-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[9.5px] text-amber-900">As assinaturas atuais preservam o preço contratado. A nova matriz só entra em vigor em novas adesões ou renovações.</div>
        </div>}
      </CommercialModal>

      <CommercialModal open={Boolean(groupDraft)} title="Novo grupo de categorias" description="O grupo recebe uma célula de preço por plano, inicialmente com o preço de referência." onClose={() => setGroupDraft(null)}
        footer={<><ManagementActionButton onClick={() => setGroupDraft(null)}>Cancelar</ManagementActionButton><ManagementActionButton tone="primary" disabled={busy} onClick={() => document.getElementById('price-group-submit')?.click()}>{busy ? 'A guardar…' : 'Criar grupo'}</ManagementActionButton></>}
      >
        {groupDraft && <form onSubmit={(event) => void createGroup(event)} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CommercialField label="Nome"><input className={commercialInputClass} value={groupDraft.name} onChange={(event) => setGroupDraft({ ...groupDraft, name: event.target.value })} required /></CommercialField>
          <CommercialField label="Código"><input className={commercialInputClass} value={groupDraft.code} onChange={(event) => setGroupDraft({ ...groupDraft, code: event.target.value })} placeholder="gerado a partir do nome se vazio" /></CommercialField>
          <CommercialField label="Descrição" className="sm:col-span-2"><textarea className={`${commercialInputClass} min-h-16`} value={groupDraft.description} onChange={(event) => setGroupDraft({ ...groupDraft, description: event.target.value })} /></CommercialField>
          <CommercialField label="Motivo" className="sm:col-span-2"><input className={commercialInputClass} value={reason} onChange={(event) => setReason(event.target.value)} /></CommercialField>
          <button id="price-group-submit" type="submit" className="hidden" />
        </form>}
      </CommercialModal>
    </CommercialPageShell>
  );
};
