import React, { useCallback, useEffect, useState } from 'react';
import { History, RotateCcw } from 'lucide-react';
import { ManagementPage, ManagementCard } from './ManagementUi';
import { Button } from '../../ui/Button';

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-700 outline-none transition focus:border-[#123e3b] focus:bg-white focus:ring-2 focus:ring-[#123e3b]/10';
const labelClass = 'block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 mb-1.5';

const emptyState = {
  logo: '',
  coverImage: '',
  primaryColor: '#3b82f6',
  secondaryColor: '#10b981',
  favicon: '',
  gallery: [] as string[],
  nomeComercial: '',
  descricaoCurta: '',
  descricaoCompleta: '',
  historia: '',
  missao: '',
  visao: '',
  valores: '',
  categoria: '',
  anoFundacao: '',
  telefone: '',
  whatsapp: '',
  emailInstitucional: '',
  website: '',
  morada: '',
  regiao: '',
  cidade: '',
  latitude: '',
  longitude: '',
  facebook: '',
  instagram: '',
  tiktok: '',
  youtube: '',
  linkedin: '',
  whatsappLink: '',
  previewMode: 'desktop',
  showPreview: true,
};

type SobreNosForm = typeof emptyState;

interface SobreNosHistoryEntry {
  id: number;
  action: string;
  changed_by: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  save: 'Guardado',
  publish: 'Publicado',
  draft: 'Rascunho',
  restore: 'Restaurado',
};

export const SobreNosManagementPage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [form, setForm] = useState<SobreNosForm>(emptyState);
  const [history, setHistory] = useState<SobreNosHistoryEntry[]>([]);
  const [isDraft, setIsDraft] = useState(true);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [fb, setFb] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<null | 'load' | 'save' | 'publish' | 'draft' | 'restore'>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/sobre-nos', { credentials: 'include' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Não foi possível carregar o Sobre Nós.');
      setForm({ ...emptyState, ...(body.data || {}) });
      setHistory(Array.isArray(body.history) ? body.history : []);
      setIsDraft(body.isDraft !== false);
      setPublishedAt(body.publishedAt || null);
      setUpdatedAt(body.updatedAt || null);
    } catch (error) {
      setFb({ tone: 'error', text: error instanceof Error ? error.message : 'Falha ao carregar.' });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const setField = (key: keyof SobreNosForm, value: string | boolean | string[]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const send = async (mode: 'save' | 'publish' | 'draft', url: string) => {
    setBusy(mode);
    setFb(null);
    try {
      const response = await fetch(url, {
        method: mode === 'save' ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: form }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Operação falhou.');
      await load();
      setIsDraft(mode !== 'publish');
      setFb({
        tone: 'ok',
        text: mode === 'publish' ? 'Sobre Nós publicado com sucesso.' : mode === 'draft' ? 'Rascunho guardado.' : 'Alterações guardadas.',
      });
    } catch (error) {
      setFb({ tone: 'error', text: error instanceof Error ? error.message : 'Operação falhou.' });
    } finally {
      setBusy(null);
    }
  };

  const restore = async (historyId: number) => {
    setBusy('restore');
    setFb(null);
    try {
      const response = await fetch(`/api/admin/sobre-nos/restore/${historyId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || 'Não foi possível restaurar a versão.');
      await load();
      setFb({ tone: 'ok', text: 'Versão restaurada como rascunho.' });
    } catch (error) {
      setFb({ tone: 'error', text: error instanceof Error ? error.message : 'Não foi possível restaurar.' });
    } finally {
      setBusy(null);
    }
  };

  const statusLabel = isDraft ? 'Rascunho' : publishedAt ? `Publicado em ${new Date(publishedAt).toLocaleString('pt-PT')}` : 'Publicado';

  return (
    <ManagementPage
      title="Sobre Nós"
      description="Identidade visual, informações institucionais e apresentação pública do Guigui.com."
      moduleLabel="Administração"
      onBack={onBack}
      breadcrumbTail="Sobre Nós"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${isDraft ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
            {statusLabel}
          </span>
          <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => void send('draft', '/api/admin/sobre-nos/draft')}>
            {busy === 'draft' ? 'A guardar…' : 'Guardar rascunho'}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => void send('save', '/api/admin/sobre-nos')}>
            {busy === 'save' ? 'A guardar…' : 'Guardar'}
          </Button>
          <Button type="button" size="sm" disabled={busy !== null} onClick={() => void send('publish', '/api/admin/sobre-nos/publish')}>
            {busy === 'publish' ? 'A publicar…' : 'Publicar'}
          </Button>
        </div>
      }
      kpis={[
        { label: 'Estado', value: isDraft ? 'Rascunho' : 'Publicado' },
        { label: 'Última alteração', value: updatedAt ? new Date(updatedAt).toLocaleDateString('pt-PT') : '—' },
        { label: 'Versões', value: String(history.length) },
      ]}
    >
      <div className="space-y-6">
        {fb && (
          <div
            role="status"
            className={`rounded-xl border px-3 py-2 text-[11px] font-bold ${fb.tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}
          >
            {fb.text}
          </div>
        )}

        <ManagementCard title="Identidade visual">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Logotipo (URL)</label>
              <input className={inputClass} value={form.logo} onChange={(e) => setField('logo', e.target.value)} placeholder="https://…/logo.png" />
            </div>
            <div>
              <label className={labelClass}>Banner (URL)</label>
              <input className={inputClass} value={form.coverImage} onChange={(e) => setField('coverImage', e.target.value)} placeholder="https://…/banner.png" />
            </div>
            <div>
              <label className={labelClass}>Cor primária</label>
              <input type="color" className={inputClass} value={form.primaryColor || '#3b82f6'} onChange={(e) => setField('primaryColor', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Cor secundária</label>
              <input type="color" className={inputClass} value={form.secondaryColor || '#10b981'} onChange={(e) => setField('secondaryColor', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Favicon (URL)</label>
              <input className={inputClass} value={form.favicon} onChange={(e) => setField('favicon', e.target.value)} placeholder="https://…/favicon.ico" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Galeria (uma URL por linha)</label>
              <textarea
                rows={3}
                className={`${inputClass} resize-none`}
                value={form.gallery.join('\n')}
                onChange={(e) => setField('gallery', e.target.value.split('\n').map((line) => line.trim()).filter(Boolean))}
                placeholder={'https://…/foto-1.jpg\nhttps://…/foto-2.jpg'}
              />
            </div>
          </div>
        </ManagementCard>

        <ManagementCard title="Informações da empresa">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Nome comercial</label>
              <input className={inputClass} value={form.nomeComercial} onChange={(e) => setField('nomeComercial', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Ano de fundação</label>
              <input
                type="number"
                min={1900}
                max={new Date().getFullYear()}
                className={inputClass}
                value={form.anoFundacao}
                onChange={(e) => setField('anoFundacao', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Descrição curta</label>
              <textarea rows={3} className={`${inputClass} resize-none`} value={form.descricaoCurta} onChange={(e) => setField('descricaoCurta', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Descrição completa</label>
              <textarea rows={3} className={`${inputClass} resize-none`} value={form.descricaoCompleta} onChange={(e) => setField('descricaoCompleta', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>História</label>
              <textarea rows={3} className={`${inputClass} resize-none`} value={form.historia} onChange={(e) => setField('historia', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Missão</label>
              <textarea rows={3} className={`${inputClass} resize-none`} value={form.missao} onChange={(e) => setField('missao', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Visão</label>
              <textarea rows={3} className={`${inputClass} resize-none`} value={form.visao} onChange={(e) => setField('visao', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Valores</label>
              <textarea rows={3} className={`${inputClass} resize-none`} value={form.valores} onChange={(e) => setField('valores', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Categoria</label>
              <select className={inputClass} value={form.categoria} onChange={(e) => setField('categoria', e.target.value)}>
                <option value="">Selecionar categoria</option>
                <option value="restauracao">Restauração</option>
                <option value="hotelaria_saude_educacao">Hotelaria, Saúde e Educação</option>
                <option value="corporativo_financeiro">Corporativo e Financeiro</option>
                <option value="ongs_artesaos">ONGs e Artesãos</option>
                <option value="servicos_profissionais">Serviços Profissionais</option>
              </select>
            </div>
          </div>
        </ManagementCard>

        <ManagementCard title="Contactos e localização">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Telefone</label>
              <input className={inputClass} value={form.telefone} onChange={(e) => setField('telefone', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>WhatsApp</label>
              <input className={inputClass} value={form.whatsapp} onChange={(e) => setField('whatsapp', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Email institucional</label>
              <input type="email" className={inputClass} value={form.emailInstitucional} onChange={(e) => setField('emailInstitucional', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Website</label>
              <input type="url" className={inputClass} value={form.website} onChange={(e) => setField('website', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Morada</label>
              <input className={inputClass} value={form.morada} onChange={(e) => setField('morada', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Região</label>
              <input className={inputClass} value={form.regiao} onChange={(e) => setField('regiao', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Cidade</label>
              <input className={inputClass} value={form.cidade} onChange={(e) => setField('cidade', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Latitude</label>
              <input type="number" step="any" className={inputClass} value={form.latitude} onChange={(e) => setField('latitude', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Longitude</label>
              <input type="number" step="any" className={inputClass} value={form.longitude} onChange={(e) => setField('longitude', e.target.value)} />
            </div>
          </div>
        </ManagementCard>

        <ManagementCard title="Redes sociais">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Facebook</label>
              <input className={inputClass} value={form.facebook} onChange={(e) => setField('facebook', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Instagram</label>
              <input className={inputClass} value={form.instagram} onChange={(e) => setField('instagram', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>TikTok</label>
              <input className={inputClass} value={form.tiktok} onChange={(e) => setField('tiktok', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>YouTube</label>
              <input className={inputClass} value={form.youtube} onChange={(e) => setField('youtube', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>LinkedIn</label>
              <input className={inputClass} value={form.linkedin} onChange={(e) => setField('linkedin', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Link WhatsApp</label>
              <input className={inputClass} value={form.whatsappLink} onChange={(e) => setField('whatsappLink', e.target.value)} />
            </div>
          </div>
        </ManagementCard>

        <ManagementCard title="Pré-visualização">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Modo de pré-visualização</label>
              <select className={inputClass} value={form.previewMode} onChange={(e) => setField('previewMode', e.target.value)}>
                <option value="desktop">Desktop</option>
                <option value="mobile">Telemóvel</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Mostrar pré-visualização</label>
              <select
                className={inputClass}
                value={form.showPreview ? 'true' : 'false'}
                onChange={(e) => setField('showPreview', e.target.value === 'true')}
              >
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </select>
            </div>
          </div>
        </ManagementCard>

        <ManagementCard title="Histórico de alterações">
          {history.length === 0 ? (
            <p className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <History className="h-4 w-4" /> Sem versões registadas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[10.5px]">
                <thead className="bg-slate-50 text-[9px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="p-2">Versão</th>
                    <th className="p-2">Ação</th>
                    <th className="p-2">Utilizador</th>
                    <th className="p-2">Data</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr key={entry.id} className="border-t border-slate-100">
                      <td className="p-2 font-bold text-slate-700">#{entry.id}</td>
                      <td className="p-2 font-semibold text-slate-700">{ACTION_LABELS[entry.action] || entry.action}</td>
                      <td className="p-2 text-slate-500">{entry.changed_by || '—'}</td>
                      <td className="p-2 text-slate-500">{new Date(entry.created_at).toLocaleString('pt-PT')}</td>
                      <td className="p-2 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy !== null}
                          onClick={() => void restore(entry.id)}
                          className="gap-1"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ManagementCard>
      </div>
    </ManagementPage>
  );
};
