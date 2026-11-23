import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  FileText,
  Globe2,
  HelpCircle,
  History,
  Image as ImageIcon,
  Layers,
  Loader2,
  Mail,
  Megaphone,
  Rocket,
  RotateCcw,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Wrench,
} from 'lucide-react'
import { Button } from '../../ui/Button'
import { InstitutionalEntityPanel } from './InstitutionalEntityPanel'
import { InstitutionalField } from './InstitutionalField'
import { InstitutionalPublicView } from './InstitutionalPublicView'
import {
  PROFILE_FIELDS,
  PURPOSE_FIELDS,
  SECTION_FIELDS,
  SECTION_KEYS,
  SECTION_LABELS,
  SEO_FIELDS,
  ENTITY_SPECS,
  loadInstitutionalAdmin,
  loadInstitutionalAudit,
  publishInstitutional,
  restoreRelease,
  saveAbout,
  saveProfile,
  savePurpose,
  saveSeo,
  type EntityKind,
  type FieldSpec,
  type InstitutionalAdminPayload,
  type InstitutionalAuditEntry,
  type SectionKey,
} from './institutionalApi'

type ModuleKey =
  | 'overview'
  | 'profile'
  | 'purpose'
  | 'about'
  | 'seo'
  | 'values'
  | 'timeline'
  | 'objectives'
  | 'departments'
  | 'team'
  | 'partners'
  | 'contacts'
  | 'social_links'
  | 'gallery'
  | 'faq'
  | 'documents'
  | 'services'
  | 'communications'
  | 'assets'
  | 'publication'
  | 'audit'

interface ModuleItem {
  key: ModuleKey
  label: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
}

interface ModuleGroup {
  label: string
  items: ModuleItem[]
}

/** 21 submódulos em 5 grupos. */
const GROUPS: ModuleGroup[] = [
  {
    label: 'Controlo',
    items: [
      { key: 'overview', label: 'Visão Geral', hint: 'Estado real da identidade institucional e atalhos para o que falta.', icon: BarChart3 },
    ],
  },
  {
    label: 'Identidade',
    items: [
      { key: 'profile', label: 'Identidade & Marca', hint: 'Nome oficial, slogan, descrições, logótipo e cores.', icon: Building2 },
      { key: 'purpose', label: 'Missão & Visão', hint: 'Propósito institucional que orienta a plataforma.', icon: Target },
      { key: 'about', label: 'Quem Somos', hint: 'Textos de apresentação: origem, contexto, problema, público.', icon: FileText },
      { key: 'seo', label: 'SEO & Partilha', hint: 'Título, descrição, imagem de partilha e indexação.', icon: Globe2 },
    ],
  },
  {
    label: 'Conteúdo institucional',
    items: [
      { key: 'values', label: 'Valores', hint: 'Princípios que definem a forma de atuar.', icon: Sparkles },
      { key: 'services', label: 'Serviços Públicos', hint: 'Funcionalidades reais apresentadas no site.', icon: Wrench },
      { key: 'communications', label: 'Comunicação', hint: 'Comunicados, novidades, anúncios e avisos.', icon: Megaphone },
      { key: 'timeline', label: 'História & Trajetória', hint: 'Marcos cronológicos da instituição.', icon: History },
      { key: 'objectives', label: 'Objetivos & Compromissos', hint: 'Compromissos por público-alvo.', icon: BadgeCheck },
      { key: 'departments', label: 'Áreas de Atuação', hint: 'Estrutura funcional e responsabilidades.', icon: Layers },
    ],
  },
  {
    label: 'Pessoas & rede',
    items: [
      { key: 'team', label: 'Equipa', hint: 'Membros, cargos e biografias.', icon: Users },
      { key: 'partners', label: 'Parceiros', hint: 'Entidades parceiras e protocolos.', icon: Share2 },
      { key: 'contacts', label: 'Contactos', hint: 'Canais oficiais por finalidade.', icon: Mail },
      { key: 'social_links', label: 'Redes Sociais', hint: 'Canais oficiais da instituição.', icon: Globe2 },
    ],
  },
  {
    label: 'Media & publicação',
    items: [
      { key: 'gallery', label: 'Galeria', hint: 'Imagens institucionais com texto alternativo.', icon: ImageIcon },
      { key: 'assets', label: 'Identidade Visual', hint: 'Logótipos, favicon, capa e restantes ativos.', icon: ImageIcon },
      { key: 'faq', label: 'Perguntas Frequentes', hint: 'Respostas às dúvidas mais comuns.', icon: HelpCircle },
      { key: 'documents', label: 'Políticas & Documentos', hint: 'Políticas, termos e documentos legais versionados.', icon: FileText },
      { key: 'publication', label: 'Publicação & Versões', hint: 'Validar, publicar e restaurar versões anteriores.', icon: Rocket },
      { key: 'audit', label: 'Histórico & Auditoria', hint: 'Registo imutável das alterações institucionais.', icon: ShieldCheck },
    ],
  },
]

const ENTITY_MODULES: ModuleKey[] = [
  'values',
  'services',
  'communications',
  'assets',
  'timeline',
  'objectives',
  'departments',
  'team',
  'partners',
  'contacts',
  'social_links',
  'gallery',
  'faq',
  'documents',
]

const ENTITY_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  audience: [
    { value: 'citizens', label: 'Cidadãos' },
    { value: 'businesses', label: 'Empresas' },
    { value: 'organizers', label: 'Organizadores' },
    { value: 'partners', label: 'Parceiros' },
  ],
  purpose: [
    { value: 'institutional', label: 'Institucional' },
    { value: 'support', label: 'Suporte' },
    { value: 'commercial', label: 'Comercial' },
    { value: 'press', label: 'Imprensa' },
  ],
}

const FieldForm: React.FC<{
  fields: Record<string, FieldSpec>
  initial: Record<string, unknown>
  labels?: Record<string, string>
  uploads?: Record<string, 'image' | 'document'>
  onSave: (values: Record<string, string | boolean>) => Promise<void>
  onFeedback: (message: string, tone?: 'ok' | 'error') => void
  saveLabel?: string
}> = ({ fields, initial, labels, uploads, onSave, onFeedback, saveLabel = 'Guardar alterações' }) => {
  const [values, setValues] = useState<Record<string, string | boolean>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const next: Record<string, string | boolean> = {}
    for (const [key, spec] of Object.entries(fields)) {
      const raw = initial[key]
      next[key] = spec.type === 'boolean' ? raw === true : String(raw ?? '')
    }
    setValues(next)
  }, [fields, initial])

  const submit = async () => {
    setBusy(true)
    try {
      await onSave(values)
      onFeedback('Alterações guardadas no rascunho.')
    } catch (error) {
      onFeedback(error instanceof Error ? error.message : 'Não foi possível guardar.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(fields).map(([key, spec]) => (
          <InstitutionalField
            key={key}
            label={labels?.[key] ?? key}
            spec={spec}
            value={values[key] ?? ''}
            onChange={(value) => setValues((prev) => ({ ...prev, [key]: value }))}
            options={spec.type === 'enum' ? ENTITY_OPTIONS[key] : undefined}
            uploadKind={uploads?.[key]}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => void submit()}>
          {busy ? 'A guardar…' : saveLabel}
        </Button>
      </div>
    </div>
  )
}

const AboutEditor: React.FC<{
  document: InstitutionalAdminPayload['document']
  onChanged: () => Promise<void>
  onFeedback: (message: string, tone?: 'ok' | 'error') => void
}> = ({ document, onChanged, onFeedback }) => {
  const [active, setActive] = useState<SectionKey>('quem_somos')
  const section = useMemo(
    () => document.sections.find((item) => item.sectionKey === active),
    [document.sections, active],
  )

  const initial = useMemo(
    () => ({
      title: String(section?.title ?? ''),
      body: String(section?.body ?? ''),
      image_url: String(section?.imageUrl ?? ''),
      isVisible: section?.isVisible !== false,
    }),
    [section],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {SECTION_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setActive(key)}
            className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition ${
              key === active
                ? 'border-[var(--color-green-900)] bg-[var(--color-green-900)] text-white'
                : 'border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            {SECTION_LABELS[key]}
          </button>
        ))}
      </div>
      <FieldForm
        key={active}
        fields={SECTION_FIELDS}
        initial={initial}
        labels={{ title: 'Título da secção', body: 'Texto', image_url: 'Imagem', isVisible: 'Visível' }}
        uploads={{ image_url: 'image' }}
        onSave={async (values) => {
          await saveAbout(active, values)
          await onChanged()
        }}
        onFeedback={onFeedback}
        saveLabel={`Guardar “${SECTION_LABELS[active]}”`}
      />
    </div>
  )
}

const OverviewPanel: React.FC<{
  data: InstitutionalAdminPayload
  onNavigate: (key: ModuleKey) => void
}> = ({ data, onNavigate }) => {
  const document = data.document
  const meta = data.meta
  const visibleCount = (rows: Array<{ isVisible?: boolean }> = []) =>
    rows.filter((row) => row.isVisible !== false).length
  const filledSections = document.sections.filter((section) => String(section.body ?? '').trim().length > 0).length
  const documentsPublished = document.entities.documents.filter(
    (item) => item.status === 'published' || (!item.status && String(item.fileUrl ?? '').trim().length > 0),
  ).length

  const rows = [
    { key: 'profile' as ModuleKey, label: 'Identidade da plataforma', done: Boolean(String(document.profile.official_name ?? '').trim()) },
    { key: 'purpose' as ModuleKey, label: 'Missão e visão', done: Boolean(String(document.purpose.mission ?? '').trim() && String(document.purpose.vision ?? '').trim()) },
    { key: 'about' as ModuleKey, label: 'Sobre o Guigui.com', done: filledSections === document.sections.length && filledSections > 0 },
    { key: 'values' as ModuleKey, label: 'Valores', done: visibleCount(document.entities.values) > 0 },
    { key: 'services' as ModuleKey, label: 'Serviços públicos', done: visibleCount(document.entities.services) > 0 },
    { key: 'contacts' as ModuleKey, label: 'Contactos oficiais', done: visibleCount(document.entities.contacts) > 0 },
    { key: 'social_links' as ModuleKey, label: 'Presença digital', done: visibleCount(document.entities.social_links) > 0 },
    { key: 'assets' as ModuleKey, label: 'Identidade visual', done: visibleCount(document.entities.assets) > 0 || Boolean(String(document.profile.logo_url ?? '').trim()) },
    { key: 'documents' as ModuleKey, label: 'Políticas e documentos', done: documentsPublished > 0 },
    { key: 'communications' as ModuleKey, label: 'Comunicação institucional', done: visibleCount(document.entities.communications) > 0 },
  ]
  const completed = rows.filter((row) => row.done).length

  const stats = [
    { label: 'Secções preenchidas', value: `${filledSections}/${document.sections.length}` },
    { label: 'Módulos completos', value: `${completed}/${rows.length}` },
    { label: 'Contactos visíveis', value: String(visibleCount(document.entities.contacts)) },
    { label: 'Serviços visíveis', value: String(visibleCount(document.entities.services)) },
    { label: 'Documentos publicados', value: String(documentsPublished) },
    { label: 'Comunicações visíveis', value: String(visibleCount(document.entities.communications)) },
    { label: 'Canais digitais', value: String(visibleCount(document.entities.social_links)) },
    { label: 'Ativos de media', value: String(visibleCount(document.entities.assets)) },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{stat.label}</p>
            <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-[12px] font-black text-slate-900 dark:text-white">Estado da organização institucional</h3>
        <p className="mt-0.5 text-[11px] text-slate-500">
          {meta.lastPublishedAt
            ? `Última publicação: ${new Date(meta.lastPublishedAt).toLocaleString('pt-PT')}${meta.lastPublishedBy ? ` por ${meta.lastPublishedBy}` : ''}.`
            : 'Ainda não existe nenhuma versão publicada.'}
          {meta.isDirty ? ' Existem alterações por publicar.' : ' O rascunho está igual ao publicado.'}
        </p>
        {meta.missing.length > 0 && (
          <p className="mt-2 rounded-xl border border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] px-3 py-2 text-[10.5px] font-bold text-[var(--tone-warning-text)]">
            {meta.missing.length} requisito(s) obrigatório(s) em falta para publicar.
          </p>
        )}
        <ul className="mt-3 divide-y divide-[var(--color-border-subtle)] dark:divide-slate-800">
          {rows.map((row) => (
            <li key={row.label} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="flex items-center gap-2 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                {row.done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-[var(--tone-success-text)]" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-[var(--tone-warning-text)]" />
                )}
                {row.label}
              </span>
              <button
                type="button"
                onClick={() => onNavigate(row.key)}
                className="rounded-lg border border-[var(--color-border-subtle)] px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600 transition hover:border-[var(--color-green-700)] dark:border-slate-700 dark:text-slate-300"
              >
                {row.done ? 'Rever' : 'Configurar'}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

const AuditPanel: React.FC = () => {
  const [entries, setEntries] = useState<InstitutionalAuditEntry[]>([])
  const [entity, setEntity] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    loadInstitutionalAudit({ entity: entity || undefined, limit: 200 })
      .then((payload) => {
        if (active) setEntries(Array.isArray(payload?.entries) ? payload.entries : [])
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o histórico.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [entity])

  const entities = Array.from(new Set(entries.map((entry) => entry.entity))).sort()

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-slate-500">
          Tipo de conteúdo
          <select
            value={entity}
            onChange={(event) => setEntity(event.target.value)}
            className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-2.5 py-2 text-[11px] font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Todos</option>
            {entities.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <span className="text-[10px] font-bold text-slate-500">{entries.length} registo(s)</span>
      </div>

      {loading && (
        <p className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> A carregar histórico…
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] px-3 py-2 text-[11px] font-bold text-[var(--tone-danger-text)]">{error}</p>
      )}
      {!loading && !error && entries.length === 0 && (
        <p className="text-[11px] text-slate-500">Ainda não existem registos de auditoria institucional.</p>
      )}
      {entries.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-[var(--color-border-subtle)] dark:border-slate-700">
          <table className="min-w-full text-left text-[11px]">
            <thead className="bg-[var(--color-bg-subtle)] text-[9px] font-black uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Ação</th>
                <th className="px-3 py-2">Registo</th>
                <th className="px-3 py-2">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)] dark:divide-slate-800">
              {entries.map((entry) => (
                <tr key={entry.id} className="text-slate-700 dark:text-slate-200">
                  <td className="px-3 py-2 font-medium">{new Date(entry.createdAt).toLocaleString('pt-PT')}</td>
                  <td className="px-3 py-2 font-bold">{entry.entity}</td>
                  <td className="px-3 py-2">{entry.action}</td>
                  <td className="px-3 py-2">{entry.entityId ?? '—'}</td>
                  <td className="px-3 py-2">{entry.changedBy ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export const InstitutionalManagementPage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [data, setData] = useState<InstitutionalAdminPayload | null>(null)
  const [active, setActive] = useState<ModuleKey>('profile')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ message: string; tone: 'ok' | 'error' } | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const notify = useCallback((message: string, tone: 'ok' | 'error' = 'ok') => {
    setFeedback({ message, tone })
  }, [])

  const load = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      setData(await loadInstitutionalAdmin())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o módulo institucional.')
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const publish = async () => {
    if (!data) return
    setBusy(true)
    try {
      const result = await publishInstitutional()
      notify(`Publicado com sucesso (versão #${result.releaseId}).`)
      await load()
    } catch (publishError) {
      notify(publishError instanceof Error ? publishError.message : 'Publicação falhou.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const restore = async (id: number) => {
    if (!window.confirm(`Restaurar a versão #${id} para o rascunho atual?`)) return
    setBusy(true)
    try {
      await restoreRelease(id)
      notify(`Versão #${id} restaurada para o rascunho. Publique para a tornar pública.`)
      await load()
    } catch (restoreError) {
      notify(restoreError instanceof Error ? restoreError.message : 'Não foi possível restaurar.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const meta = data?.meta
  const document = data?.document

  const moduleContent = () => {
    if (!data || !document) return null
    if (active === 'profile') {
      return (
        <FieldForm
          fields={PROFILE_FIELDS}
          initial={document.profile}
          labels={{
            official_name: 'Nome oficial',
            trade_name: 'Nome comercial',
            slogan: 'Slogan',
            short_description: 'Descrição curta',
            long_description: 'Descrição longa',
            platform_info: 'Informação da plataforma',
            logo_url: 'Logótipo',
            favicon_url: 'Favicon',
            share_image_url: 'Imagem de partilha',
            primary_color: 'Cor principal',
            secondary_color: 'Cor secundária',
            founded_year: 'Ano de fundação',
            domain: 'Domínio principal',
            country: 'País de origem',
            category: 'Categoria da plataforma',
            primary_language: 'Idioma principal',
            supported_languages: 'Idiomas suportados',
            launch_date: 'Data de lançamento',
          }}
          uploads={{ logo_url: 'image', favicon_url: 'image', share_image_url: 'image' }}
          onSave={async (values) => {
            await saveProfile(values)
            await load()
          }}
          onFeedback={notify}
        />
      )
    }
    if (active === 'purpose') {
      return (
        <FieldForm
          fields={PURPOSE_FIELDS}
          initial={document.purpose}
          labels={{ mission: 'Missão', vision: 'Visão' }}
          onSave={async (values) => {
            await savePurpose(values)
            await load()
          }}
          onFeedback={notify}
        />
      )
    }
    if (active === 'seo') {
      return (
        <FieldForm
          fields={SEO_FIELDS}
          initial={document.seo}
          labels={{
            seo_title: 'Título SEO',
            meta_description: 'Meta descrição',
            slug: 'Slug',
            og_image_url: 'Imagem de partilha',
            canonical_url: 'URL canónica',
            no_index: 'Não indexar (noindex)',
          }}
          uploads={{ og_image_url: 'image' }}
          onSave={async (values) => {
            await saveSeo(values)
            await load()
          }}
          onFeedback={notify}
        />
      )
    }
    if (active === 'about') {
      return <AboutEditor document={document} onChanged={load} onFeedback={notify} />
    }
    if (active === 'overview') {
      return <OverviewPanel data={data} onNavigate={setActive} />
    }
    if (active === 'audit') {
      return <AuditPanel />
    }
    if (active === 'publication') {
      return (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4 dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-[12px] font-black text-slate-900 dark:text-white">Estado da publicação</h3>
            <dl className="mt-2 grid gap-2 text-[11px] sm:grid-cols-2">
              <div>
                <dt className="text-[9px] font-black uppercase tracking-wide text-slate-500">Última publicação</dt>
                <dd className="font-bold text-slate-800 dark:text-slate-100">
                  {meta?.lastPublishedAt ? new Date(meta.lastPublishedAt).toLocaleString('pt-PT') : 'Ainda não publicado'}
                </dd>
              </div>
              <div>
                <dt className="text-[9px] font-black uppercase tracking-wide text-slate-500">Alterações por publicar</dt>
                <dd className="font-bold text-slate-800 dark:text-slate-100">
                  {meta?.isDirty ? 'Existem alterações no rascunho' : 'Rascunho igual ao publicado'}
                </dd>
              </div>
            </dl>
            {meta && meta.missing.length > 0 ? (
              <div className="mt-3 rounded-xl border border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-black text-[var(--tone-warning-text)]">
                  <AlertTriangle className="h-3.5 w-3.5" /> Conteúdo obrigatório em falta
                </p>
                <ul className="mt-1.5 space-y-0.5 text-[10.5px] text-[var(--tone-warning-text)]">
                  {meta.missing.map((item) => (
                    <li key={`${item.label}-${item.detail}`}>
                      <strong>{item.label}:</strong> {item.detail}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-[var(--tone-success-text)]">
                <CheckCircle2 className="h-3.5 w-3.5" /> Conteúdo obrigatório completo.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={busy || !meta?.canPublish} onClick={() => void publish()}>
                {busy ? 'A publicar…' : 'Publicar versão'}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowPreview((value) => !value)}>
                {showPreview ? 'Ocultar pré-visualização' : 'Pré-visualizar rascunho'}
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4 dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-[12px] font-black text-slate-900 dark:text-white">Histórico de versões</h3>
            {meta && meta.releases.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {meta.releases.map((release) => (
                  <li
                    key={release.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-border-subtle)] px-3 py-2 text-[11px] dark:border-slate-800"
                  >
                    <span className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
                      <CalendarClock className="h-3.5 w-3.5 text-slate-500" />#{release.id} ·{' '}
                      {release.publishedAt ? new Date(release.publishedAt).toLocaleString('pt-PT') : '—'}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void restore(release.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border-subtle)] px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                    >
                      <RotateCcw className="h-3 w-3" /> Restaurar
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[11px] text-slate-500">Sem versões publicadas.</p>
            )}
          </div>

          {showPreview && (
            <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4 dark:border-slate-700 dark:bg-slate-900">
              <InstitutionalPublicView data={data.snapshot} preview />
            </div>
          )}
        </div>
      )
    }
    if (ENTITY_MODULES.includes(active)) {
      const kind = active as EntityKind
      return (
        <InstitutionalEntityPanel
          kind={kind}
          rows={document.entities[kind] ?? []}
          onChanged={load}
          onFeedback={notify}
        />
      )
    }
    return null
  }

  const activeItem = GROUPS.flatMap((group) => group.items).find((item) => item.key === active)
  const activeSpec = ENTITY_MODULES.includes(active) ? ENTITY_SPECS[active as EntityKind] : null

  return (
    <div className="space-y-4">
      <header className="rounded-2xl border border-slate-800 bg-gradient-to-r from-[#0b3b37] to-slate-900 p-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-emerald-300">Módulo institucional</p>
            <h2 className="mt-1 flex items-center gap-2 text-lg font-black">
              <Building2 className="h-5 w-5" /> Identidade Institucional
            </h2>
            <p className="mt-1 max-w-2xl text-[11.5px] leading-relaxed text-white/75">
              21 submódulos organizados em 5 grupos. As alterações ficam no rascunho até publicar uma versão.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${
                meta?.isDirty ? 'bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)]' : 'bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]'
              }`}
            >
              {meta?.isDirty ? 'Rascunho por publicar' : 'Publicado'}
            </span>
            {onBack && (
              <Button type="button" size="sm" variant="secondary" onClick={onBack}>
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Voltar
              </Button>
            )}
          </div>
        </div>
      </header>

      {feedback && (
        <div
          className={`rounded-xl border px-3 py-2 text-[11px] font-bold ${
            feedback.tone === 'error'
              ? 'border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] text-[var(--tone-danger-text)]'
              : 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {busy && !data && (
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5 text-[11px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" /> A carregar módulo institucional…
        </div>
      )}

      {error && !busy && (
        <div className="space-y-2 rounded-2xl border border-[var(--tone-danger-border)] bg-[var(--tone-danger-bg)] p-4 text-[11px] font-bold text-[var(--tone-danger-text)]">
          <p className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" /> {error}
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {data && (
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <nav aria-label="Submódulos institucionais" className="space-y-3">
            {GROUPS.map((group) => (
              <div key={group.label}>
                <p className="px-1 pb-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const isActive = item.key === active
                    return (
                      <li key={item.key}>
                        <button
                          type="button"
                          onClick={() => setActive(item.key)}
                          className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[11px] font-bold transition ${
                            isActive
                              ? 'bg-[var(--color-green-900)] text-white'
                              : 'text-slate-600 hover:bg-[var(--color-bg-subtle)] dark:text-slate-300 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <section className="min-w-0 space-y-3">
            <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4 dark:border-slate-700 dark:bg-slate-900">
              <h3 className="text-[13px] font-black text-slate-900 dark:text-white">{activeItem?.label}</h3>
              <p className="mt-0.5 text-[11px] text-slate-500">{activeItem?.hint}</p>
              {activeSpec && (
                <p className="mt-1 text-[10px] font-bold text-slate-500">
                  {(document?.entities[active as EntityKind] ?? []).length} registo(s)
                </p>
              )}
            </div>
            {moduleContent()}
          </section>
        </div>
      )}
    </div>
  )
}