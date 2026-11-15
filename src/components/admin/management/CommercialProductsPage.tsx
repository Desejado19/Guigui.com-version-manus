import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, Edit2, Package, Plus, Receipt } from 'lucide-react';
import {
  ManagementActionButton,
  ManagementTable,
  ManagementToolbar,
  type ManagementColumn,
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
  formatCommercialXOF,
  type CommercialOverview,
  type CommercialProduct,
} from './commercialApi';

type ProductDraft = {
  id?: string;
  name: string;
  code: string;
  description: string;
  productType: string;
  unit: string;
  billingModel: string;
  basePriceXOF: number;
  periodDays: string;
  quantity: number;
  requiresQuote: boolean;
  isActive: boolean;
  isPublic: boolean;
};

type SalesRow = { productCode: string; count: number; grossXOF: number; feeXOF: number };

const emptyProduct = (): ProductDraft => ({ name: '', code: '', description: '', productType: 'other', unit: 'service', billingModel: 'one_time', basePriceXOF: 0, periodDays: '', quantity: 1, requiresQuote: false, isActive: true, isPublic: false });
const fromProduct = (product: CommercialProduct): ProductDraft => ({ id: product.id, name: product.name, code: product.code, description: product.description, productType: product.productType, unit: product.unit, billingModel: product.billingModel, basePriceXOF: product.basePriceXOF, periodDays: product.periodDays === null ? '' : String(product.periodDays), quantity: product.quantity, requiresQuote: product.requiresQuote, isActive: product.isActive, isPublic: product.isPublic });

export const CommercialProductsPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [overview, setOverview] = useState<CommercialOverview | null>(null);
  const [sales, setSales] = useState<SalesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [reason, setReason] = useState('');
  const [tab, setTab] = useState<'products' | 'packages' | 'sales'>('products');
  const [packageDraft, setPackageDraft] = useState<{ code: string; name: string; description: string; priceXOF: number; items: Array<{ productId: string; quantity: number }> } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [data, salesData] = await Promise.all([
        commercialRequest<CommercialOverview>('/api/admin/commercial/overview'),
        commercialRequest<{ items: SalesRow[] }>('/api/admin/commercial/product-sales'),
      ]);
      setOverview(data);
      setSales(salesData.items);
      setError('');
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const products = overview?.products || [];
  const packages = overview?.packages || [];
  const totalSales = sales.reduce((sum, row) => sum + row.count, 0);
  const grossSales = sales.reduce((sum, row) => sum + row.grossXOF, 0);
  const filtered = useMemo(() => products.filter((product) => !query || `${product.name} ${product.code} ${product.description} ${product.productType}`.toLowerCase().includes(query.toLowerCase())), [products, query]);
  const kpis: ManagementKpi[] = [
    { label: 'Produtos comerciais', value: products.length, hint: `${products.filter((product) => product.isActive).length} ativos`, tone: 'info' },
    { label: 'Pacotes', value: packages.length, hint: 'Preço próprio e composição', tone: 'neutral' },
    { label: 'Vendas registadas', value: totalSales, hint: 'Ledger comercial', tone: 'success' },
    { label: 'Valor vendido', value: formatCommercialXOF(grossSales), hint: 'Não inclui subscrições', tone: 'warning' },
  ];

  const saveProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    try {
      const body = {
        ...draft,
        periodDays: draft.periodDays === '' ? null : Number(draft.periodDays),
        reason: reason || (draft.id ? 'Edição de produto comercial' : 'Criação de produto comercial'),
      };
      if (draft.id) await commercialRequest(`/api/admin/commercial/products/${draft.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await commercialRequest('/api/admin/commercial/products', { method: 'POST', body: JSON.stringify(body) });
      setDraft(null);
      setReason('');
      setNotice(draft.id ? 'Produto atualizado.' : 'Produto criado no catálogo comercial.');
      await load();
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleProduct = async (product: CommercialProduct) => {
    setBusy(true);
    try {
      await commercialRequest(`/api/admin/commercial/products/${product.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !product.isActive, reason: product.isActive ? 'Desativação de produto' : 'Reativação de produto' }) });
      setNotice(product.isActive ? `${product.name} desativado. Vendas históricas preservadas.` : `${product.name} reativado.`);
      await load();
    } catch (toggleError) {
      setError((toggleError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const createPackage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!packageDraft) return;
    setBusy(true);
    try {
      await commercialRequest('/api/admin/commercial/packages', {
        method: 'POST',
        body: JSON.stringify({ ...packageDraft, reason: reason || 'Criação de pacote comercial' }),
      });
      setPackageDraft(null);
      setReason('');
      setNotice('Pacote comercial criado.');
      await load();
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const productColumns: Array<ManagementColumn<CommercialProduct>> = [
    { key: 'product', label: 'Produto', sortable: true, render: (product) => <div><div className="font-black text-slate-900">{product.name}</div><div className="text-[9px] text-slate-500">{product.code} · {product.productType}</div></div> },
    { key: 'price', label: 'Preço unitário', sortable: true, render: (product) => <div><div className="font-bold">{product.requiresQuote ? 'Sob orçamento' : formatCommercialXOF(product.basePriceXOF)}</div><div className="text-[9px] text-slate-500">{product.billingModel}{product.periodDays ? ` · ${product.periodDays} dias` : ''}</div></div> },
    { key: 'unit', label: 'Unidade / quantidade', render: (product) => <div>{product.unit}<div className="text-[9px] text-slate-500">base {product.quantity}</div></div> },
    { key: 'sales', label: 'Vendas', render: (product) => { const row = sales.find((item) => item.productCode === product.code); return <div><strong>{row?.count ?? 0}</strong><div className="text-[9px] text-slate-500">{formatCommercialXOF(row?.grossXOF || 0)}</div></div>; } },
    { key: 'status', label: 'Estado', render: (product) => <div className="flex flex-wrap gap-1"><span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${product.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>{product.isActive ? 'Ativo' : 'Inativo'}</span>{product.isPublic && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[9px] font-black text-sky-700">Público</span>}</div> },
    { key: 'actions', label: 'Ações', render: (product) => <div className="flex justify-end gap-1"><ManagementActionButton onClick={() => { setDraft(fromProduct(product)); setReason(''); }}><Edit2 className="h-3 w-3" /> Editar</ManagementActionButton><ManagementActionButton tone={product.isActive ? 'warning' : 'success'} onClick={() => void toggleProduct(product)} disabled={busy}>{product.isActive ? 'Desativar' : 'Ativar'}</ManagementActionButton></div> },
  ];

  return (
    <CommercialPageShell
      title="Produtos, Extras e Pacotes"
      description="Catálogo independente dos planos. Preço unitário, escalões, período, modelo de cobrança, pacotes e vendas registadas ficam separados das subscrições."
      onBack={onBack}
      breadcrumb="Produtos e Pacotes"
      kpis={kpis}
      actions={<div className="flex gap-1"><ManagementActionButton onClick={() => { setPackageDraft({ code: '', name: '', description: '', priceXOF: 0, items: [{ productId: products[0]?.id || '', quantity: 1 }] }); setReason(''); }}><Package className="h-3.5 w-3.5" /> Novo pacote</ManagementActionButton><ManagementActionButton tone="primary" onClick={() => { setDraft(emptyProduct()); setReason(''); }}><Plus className="h-3.5 w-3.5" /> Novo produto</ManagementActionButton></div>}
    >
      {error && <CommercialMessage tone="error">{error}</CommercialMessage>}
      {notice && <CommercialMessage tone="success">{notice}</CommercialMessage>}
      <div className="flex flex-wrap gap-1.5">
        {([['products', 'Produtos'], ['packages', 'Pacotes'], ['sales', 'Vendas']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-xl border px-3 py-1.5 text-[10px] font-black ${tab === value ? 'border-[#123e3b] bg-[#123e3b] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>{label} ({value === 'products' ? products.length : value === 'packages' ? packages.length : totalSales})</button>)}
      </div>
      {loading ? <CommercialLoading /> : tab === 'products' ? (
        <>
          <ManagementToolbar query={query} onQueryChange={setQuery} placeholder="Pesquisar produto, código ou tipo…" totalLabel={`${filtered.length} produto(s)`} onReset={() => setQuery('')} />
          <ManagementTable columns={productColumns} rows={filtered} rowKey={(product) => product.id} />
        </>
      ) : tab === 'packages' ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {packages.map((pkg) => <section key={pkg.id} className="rounded-2xl border border-[#e6dac8] bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><Boxes className="h-4 w-4 text-[#123e3b]" /><h3 className="font-black text-slate-900">{pkg.name}</h3></div><div className="mt-1 text-[9px] text-slate-500">{pkg.code} · v{pkg.version}</div><p className="mt-2 min-h-8 text-[10px] text-slate-600">{pkg.description || 'Sem descrição.'}</p><div className="mt-3 text-lg font-black text-[#123e3b]">{formatCommercialXOF(pkg.priceXOF)}</div><div className="text-[9px] text-slate-500">{pkg.isActive ? 'Ativo' : 'Inativo'}</div></section>)}
          {packages.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-[10.5px] text-slate-500">Ainda não existem pacotes comerciais. Crie um com produtos existentes.</div>}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#e6dac8] bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-[10.5px]"><thead className="bg-[#f7f2ec] text-[9px] uppercase tracking-wide text-slate-500"><tr><th className="p-3">Código do produto</th><th className="p-3">Vendas</th><th className="p-3">Valor bruto</th><th className="p-3">Taxa da plataforma</th></tr></thead><tbody>{sales.map((row) => <tr key={row.productCode || 'unknown'} className="border-t border-slate-100"><td className="p-3 font-black text-slate-800">{row.productCode || '—'}</td><td className="p-3">{row.count}</td><td className="p-3 font-bold">{formatCommercialXOF(row.grossXOF)}</td><td className="p-3">{formatCommercialXOF(row.feeXOF)}</td></tr>)}</tbody></table>
          {sales.length === 0 && <div className="p-8 text-center text-[10.5px] text-slate-500">Sem vendas comerciais registadas no ledger.</div>}
          <div className="border-t border-slate-100 bg-slate-50 p-2.5 text-[9.5px] text-slate-600"><Receipt className="mr-1 inline h-3 w-3" /> Vendas lidas do ledger real; não são criados pagamentos fictícios nesta página.</div>
        </div>
      )}

      <CommercialModal open={Boolean(draft)} title={draft?.id ? 'Editar produto' : 'Novo produto'} description="Código único obrigatório. Produtos de subscrição não devem ser misturados com extras." onClose={() => setDraft(null)} wide
        footer={<><ManagementActionButton onClick={() => setDraft(null)}>Cancelar</ManagementActionButton><ManagementActionButton tone="primary" disabled={busy} onClick={() => document.getElementById('product-form-submit')?.click()}>{busy ? 'A guardar…' : 'Guardar produto'}</ManagementActionButton></>}
      >
        {draft && <form onSubmit={(event) => void saveProduct(event)} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CommercialField label="Nome"><input className={commercialInputClass} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></CommercialField>
          <CommercialField label="Código único"><input className={commercialInputClass} value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })} required /></CommercialField>
          <CommercialField label="Tipo"><select className={commercialInputClass} value={draft.productType} onChange={(event) => setDraft({ ...draft, productType: event.target.value })}><option value="extra_posts">Publicações extra</option><option value="extra_promotions">Promoções extra</option><option value="advertising">Publicidade</option><option value="push_campaign">Campanha push</option><option value="content_service">Serviço de conteúdo</option><option value="ticket_fee">Taxa de bilheteira</option><option value="other">Outro</option></select></CommercialField>
          <CommercialField label="Unidade"><input className={commercialInputClass} value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} /></CommercialField>
          <CommercialField label="Modelo de cobrança"><select className={commercialInputClass} value={draft.billingModel} onChange={(event) => setDraft({ ...draft, billingModel: event.target.value })}><option value="one_time">Pagamento único</option><option value="per_day">Por dia</option><option value="per_week">Por semana</option><option value="per_month">Por mês</option><option value="percentage_plus_fixed">Percentagem + fixa</option><option value="quote">Orçamento</option></select></CommercialField>
          <CommercialField label="Preço base (XOF)"><input type="number" min={0} className={commercialInputClass} value={draft.basePriceXOF} onChange={(event) => setDraft({ ...draft, basePriceXOF: Math.max(0, Number(event.target.value) || 0) })} /></CommercialField>
          <CommercialField label="Duração (dias)"><input type="number" min={0} className={commercialInputClass} value={draft.periodDays} onChange={(event) => setDraft({ ...draft, periodDays: event.target.value })} placeholder="Sem duração fixa" /></CommercialField>
          <CommercialField label="Quantidade base"><input type="number" min={1} className={commercialInputClass} value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: Math.max(1, Number(event.target.value) || 1) })} /></CommercialField>
          <CommercialField label="Motivo" className="sm:col-span-2"><input className={commercialInputClass} value={reason} onChange={(event) => setReason(event.target.value)} /></CommercialField>
          <CommercialField label="Descrição" className="sm:col-span-2"><textarea className={`${commercialInputClass} min-h-16`} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></CommercialField>
          <div className="sm:col-span-2 flex flex-wrap gap-3 rounded-xl bg-slate-50 p-3 text-[10px] font-bold"><label className="flex items-center gap-1.5"><input type="checkbox" checked={draft.requiresQuote} onChange={(event) => setDraft({ ...draft, requiresQuote: event.target.checked })} className="h-3.5 w-3.5 accent-[#123e3b]" /> Requer orçamento</label><label className="flex items-center gap-1.5"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} className="h-3.5 w-3.5 accent-[#123e3b]" /> Ativo</label><label className="flex items-center gap-1.5"><input type="checkbox" checked={draft.isPublic} onChange={(event) => setDraft({ ...draft, isPublic: event.target.checked })} className="h-3.5 w-3.5 accent-[#123e3b]" /> Público</label></div>
          <button id="product-form-submit" type="submit" className="hidden" />
        </form>}
      </CommercialModal>

      <CommercialModal open={Boolean(packageDraft)} title="Novo pacote" description="O preço do pacote é próprio; a composição referencia produtos existentes e quantidades." onClose={() => setPackageDraft(null)} wide
        footer={<><ManagementActionButton onClick={() => setPackageDraft(null)}>Cancelar</ManagementActionButton><ManagementActionButton tone="primary" disabled={busy} onClick={() => document.getElementById('package-form-submit')?.click()}>{busy ? 'A guardar…' : 'Criar pacote'}</ManagementActionButton></>}
      >
        {packageDraft && <form onSubmit={(event) => void createPackage(event)} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CommercialField label="Nome"><input className={commercialInputClass} value={packageDraft.name} onChange={(event) => setPackageDraft({ ...packageDraft, name: event.target.value })} required /></CommercialField>
            <CommercialField label="Código"><input className={commercialInputClass} value={packageDraft.code} onChange={(event) => setPackageDraft({ ...packageDraft, code: event.target.value.toUpperCase() })} required /></CommercialField>
            <CommercialField label="Preço do pacote (XOF)"><input type="number" min={0} className={commercialInputClass} value={packageDraft.priceXOF} onChange={(event) => setPackageDraft({ ...packageDraft, priceXOF: Math.max(0, Number(event.target.value) || 0) })} /></CommercialField>
            <CommercialField label="Motivo"><input className={commercialInputClass} value={reason} onChange={(event) => setReason(event.target.value)} /></CommercialField>
            <CommercialField label="Descrição" className="sm:col-span-2"><textarea className={`${commercialInputClass} min-h-16`} value={packageDraft.description} onChange={(event) => setPackageDraft({ ...packageDraft, description: event.target.value })} /></CommercialField>
          </div>
          <div className="space-y-2 rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between"><strong className="text-[10px] uppercase text-slate-500">Produtos incluídos</strong><ManagementActionButton onClick={() => setPackageDraft({ ...packageDraft, items: [...packageDraft.items, { productId: products[0]?.id || '', quantity: 1 }] })}><Plus className="h-3 w-3" /> Adicionar</ManagementActionButton></div>
            {packageDraft.items.map((item, index) => <div key={`${item.productId}-${index}`} className="grid grid-cols-[1fr_90px_auto] gap-2"><select aria-label={`Produto ${index + 1}`} className={commercialInputClass} value={item.productId} onChange={(event) => setPackageDraft({ ...packageDraft, items: packageDraft.items.map((candidate, i) => i === index ? { ...candidate, productId: event.target.value } : candidate) })}>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.code}</option>)}</select><input aria-label={`Quantidade ${index + 1}`} type="number" min={1} className={commercialInputClass} value={item.quantity} onChange={(event) => setPackageDraft({ ...packageDraft, items: packageDraft.items.map((candidate, i) => i === index ? { ...candidate, quantity: Math.max(1, Number(event.target.value) || 1) } : candidate) })} /><ManagementActionButton tone="danger" onClick={() => setPackageDraft({ ...packageDraft, items: packageDraft.items.filter((_, i) => i !== index) })}>Remover</ManagementActionButton></div>)}
          </div>
          <button id="package-form-submit" type="submit" className="hidden" />
        </form>}
      </CommercialModal>
    </CommercialPageShell>
  );
};
