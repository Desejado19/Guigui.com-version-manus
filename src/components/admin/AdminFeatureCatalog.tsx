import React, { useMemo, useState } from 'react';
import { Layers, Plus, X, Edit2, Check, Archive } from 'lucide-react';
import type { Language, SubscriptionFeature } from '../../types';
import { getTranslation } from '../../utils/i18n';
import { usePersistentState } from '../../utils/persistentState';
import { DEFAULT_SUBSCRIPTION_FEATURES } from '../../data/subscriptionCatalog';
import { Badge, Button, Card, EmptyState, IconButton } from '../../ui';

type CatalogModuleId =
  | 'identity'
  | 'directorio'
  | 'publicacoes'
  | 'promocoes'
  | 'eventos'
  | 'bilheteira'
  | 'mensagens'
  | 'suporte'
  | 'analytics'
  | 'pagamento'
  | 'admin';

interface CatalogModule {
  id: CatalogModuleId;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  subModules: CatalogSubModule[];
}

interface CatalogSubModule {
  id: string;
  name: string;
  description: string;
  features: CatalogFeatureBinding[];
}

interface CatalogFeatureBinding {
  featureId: string;
  label: string;
  required: boolean;
  active: boolean;
}

interface AdminFeatureCatalogProps {
  currentLang: Language;
}

const DEFAULT_CATALOG: CatalogModule[] = [
  {
    id: 'identity',
    name: 'Identidade e Conta',
    description: 'Acesso, perfis, autenticação e consentimentos.',
    icon: Layers,
    subModules: [
      {
        id: 'identidade-perimetro',
        name: 'Perímetro de identidade',
        description: 'Conta cidadã, perfil empresa e admin.',
        features: [
          { featureId: 'standard_profile', label: 'Ficha padrão', required: true, active: true },
          { featureId: 'expanded_profile', label: 'Ficha expandida', required: false, active: true },
          { featureId: 'verified_badge', label: 'Badge Verificado', required: false, active: true },
        ],
      },
      {
        id: 'identidade-acesso',
        name: 'Acesso e permissões',
        description: 'RBAC, multi-tenância e níveis administrativos.',
        features: [
          { featureId: 'account_manager', label: 'Gestor de conta', required: false, active: true },
          { featureId: 'custom_branding', label: 'Branding próprio', required: false, active: false },
        ],
      },
    ],
  },
  {
    id: 'directorio',
    name: 'Diretório',
    description: 'Presença no marketplace, categorias e destaques.',
    icon: Layers,
    subModules: [
      {
        id: 'directorio-visibilidade',
        name: 'Visibilidade',
        description: 'Aparecimento na lista e busca.',
        features: [
          { featureId: 'search_priority', label: 'Prioridade na pesquisa', required: false, active: true },
          { featureId: 'homepage_rotation', label: 'Rotação na homepage', required: false, active: false },
          { featureId: 'exclusive_banner', label: 'Banner exclusivo', required: false, active: false },
        ],
      },
      {
        id: 'directorio-limites',
        name: 'Limites estruturais',
        description: 'Categorias, imagens e custos associados.',
        features: [
          { featureId: 'posts', label: 'Publicações', required: true, active: true },
          { featureId: 'promotions', label: 'Promoções', required: false, active: true },
          { featureId: 'events', label: 'Eventos', required: false, active: true },
        ],
      },
    ],
  },
  {
    id: 'publicacoes',
    name: 'Publicações e Conteúdo',
    description: 'Posts, stories e moderação.',
    icon: Layers,
    subModules: [
      {
        id: 'conteudo-editor',
        name: 'Editor de conteúdo',
        description: 'Criação de posts e multimédia.',
        features: [
          { featureId: 'posts', label: 'Publicações', required: true, active: true },
          { featureId: 'basic_statistics', label: 'Estatísticas simples', required: false, active: true },
          { featureId: 'advanced_statistics', label: 'Estatísticas detalhadas', required: false, active: false },
        ],
      },
      {
        id: 'conteudo-moderacao',
        name: 'Fluxo de moderação',
        description: 'Classificação IA e revisão humana.',
        features: [
          { featureId: 'posts', label: 'Publicações', required: true, active: true },
          { featureId: 'promotions', label: 'Promoções', required: false, active: true },
        ],
      },
    ],
  },
  {
    id: 'promocoes',
    name: 'Promoções e Campanhas',
    description: 'Ofertas, cupões e campanhas comerciais.',
    icon: Layers,
    subModules: [
      {
        id: 'promocoes-criacao',
        name: 'Criação de promoções',
        description: 'Ofertas, banners e publicidade.',
        features: [
          { featureId: 'promotions', label: 'Promoções', required: true, active: true },
          { featureId: 'advertising', label: 'Publicidade', required: false, active: false },
        ],
      },
      {
        id: 'promocoes-gestao',
        name: 'Gestão comercial',
        description: 'Audiência, orçamento e relatórios de campanha.',
        features: [
          { featureId: 'monthly_reports', label: 'Relatórios mensais', required: false, active: false },
          { featureId: 'advanced_statistics', label: 'Estatísticas detalhadas', required: false, active: false },
        ],
      },
    ],
  },
  {
    id: 'eventos',
    name: 'Eventos e Bilheteira',
    description: 'Agenda cultural, vendas e validação de entradas.',
    icon: Layers,
    subModules: [
      {
        id: 'eventos-gestao',
        name: 'Gestão de eventos',
        description: 'Criação, agenda e organização cultural.',
        features: [
          { featureId: 'events', label: 'Eventos', required: true, active: true },
          { featureId: 'ticketing', label: 'Bilheteira', required: true, active: true },
        ],
      },
      {
        id: 'eventos-operacoes',
        name: 'Operações de porta',
        description: 'QR, PIN e validação por equipa autorizada.',
        features: [
          { featureId: 'ticketing', label: 'Bilheteira', required: true, active: true },
        ],
      },
    ],
  },
  {
    id: 'mensagens',
    name: 'Mensagens e Atendimento',
    description: 'Conversas, suporte e notificações.',
    icon: Layers,
    subModules: [
      {
        id: 'comunicacao',
        name: 'Comunicação',
        description: 'Conversas empresário-cliente e suporte.',
        features: [
          { featureId: 'account_manager', label: 'Gestor de conta', required: false, active: true },
        ],
      },
      {
        id: 'notificacoes',
        name: 'Notificações',
        description: 'Preferências e canais de notificação.',
        features: [
          { featureId: 'monthly_reports', label: 'Relatórios mensais', required: false, active: false },
        ],
      },
    ],
  },
  {
    id: 'suporte',
    name: 'Suporte e Conta',
    description: 'Gestão de tickets, SLA e operações.',
    icon: Layers,
    subModules: [
      {
        id: 'suporte-interno',
        name: 'Suporte comercial',
        description: 'Acompanhamento dedicado e relatórios.',
        features: [
          { featureId: 'account_manager', label: 'Gestor de conta', required: false, active: true },
          { featureId: 'monthly_reports', label: 'Relatórios mensais', required: false, active: false },
        ],
      },
    ],
  },
  {
    id: 'analytics',
    name: 'Analytics e Relatórios',
    description: 'Estatísticas, métricas e exportação.',
    icon: Layers,
    subModules: [
      {
        id: 'analytics-visao',
        name: 'Visão e métricas',
        description: 'Estatísticas de alcance e conversão.',
        features: [
          { featureId: 'basic_statistics', label: 'Estatísticas simples', required: false, active: true },
          { featureId: 'advanced_statistics', label: 'Estatísticas detalhadas', required: false, active: true },
          { featureId: 'monthly_reports', label: 'Relatórios mensais', required: false, active: false },
        ],
      },
    ],
  },
  {
    id: 'pagamento',
    name: 'Pagamento e Faturação',
    description: 'Comissões, taxas, carteira e catálogo comercial.',
    icon: Layers,
    subModules: [
      {
        id: 'pagamento-taxas',
        name: 'Taxas e comissões',
        description: 'Políticas de bilheteira e extra consumo.',
        features: [
          { featureId: 'ticketing', label: 'Bilheteira', required: false, active: true },
          { featureId: 'advertising', label: 'Publicidade', required: false, active: false },
        ],
      },
    ],
  },
  {
    id: 'admin',
    name: 'Governo e Administração',
    description: 'Governança SaaS, catálogo, auditoria e feature flags.',
    icon: Layers,
    subModules: [
      {
        id: 'admin-catalogo',
        name: 'Catálogo e regras',
        description: 'Catálogo administrável de features e limites.',
        features: [
          { featureId: 'standard_profile', label: 'Ficha padrão', required: true, active: true },
          { featureId: 'advanced_statistics', label: 'Estatísticas detalhadas', required: false, active: true },
        ],
      },
      {
        id: 'admin-flag',
        name: 'Feature flags',
        description: 'Ativação gradual de funcionalidades.',
        features: [
          { featureId: 'custom_branding', label: 'Branding próprio', required: false, active: false },
          { featureId: 'exclusive_banner', label: 'Banner exclusivo', required: false, active: false },
        ],
      },
    ],
  },
];

const slugToLabel: Record<string, string> = {
  standard_profile: 'Ficha padrão',
  expanded_profile: 'Ficha expandida',
  basic_statistics: 'Estatísticas simples',
  advanced_statistics: 'Estatísticas detalhadas',
  verified_badge: 'Badge Verificado',
  homepage_rotation: 'Rotação na homepage',
  search_priority: 'Prioridade na pesquisa',
  account_manager: 'Gestor de conta',
  monthly_reports: 'Relatórios mensais',
  exclusive_banner: 'Banner exclusivo',
  custom_branding: 'Branding próprio',
  posts: 'Publicações',
  promotions: 'Promoções',
  events: 'Eventos',
  ticketing: 'Bilheteira',
  advertising: 'Publicidade',
};

export const AdminFeatureCatalog: React.FC<AdminFeatureCatalogProps> = ({ currentLang = 'pt' as Language }) => {
  const t = (key: string, variables?: Record<string, string | number>) => getTranslation(currentLang, key, variables);
  const [features, setFeatures] = usePersistentState<SubscriptionFeature[]>('guigui_subscription_features', DEFAULT_SUBSCRIPTION_FEATURES);
  const [catalog, setCatalog] = usePersistentState<CatalogModule[]>('guigui_feature_catalog', DEFAULT_CATALOG);
  const [activeModuleId, setActiveModuleId] = useState<CatalogModuleId>('directorio');
  const [editingBinding, setEditingBinding] = useState<{ moduleId: CatalogModuleId; subModuleId: string; featureId: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(null), 3500); };
  const setFeatureActive = (featureId: string, active: boolean) => {
    setFeatures((current) => current.map((feature) => feature.id === featureId ? { ...feature, isActive: active, updatedAt: new Date().toISOString() } : feature));
    setCatalog((current) =>
      current.map((module) => ({
        ...module,
        subModules: module.subModules.map((sub) => ({
          ...sub,
          features: sub.features.map((binding) => (binding.featureId === featureId ? { ...binding, active } : binding)),
        })),
      }))
    );
  };

  const activeModule = useMemo(() => catalog.find((module) => module.id === activeModuleId) ?? catalog[0], [catalog, activeModuleId]);
  const featureMap = useMemo(() => new Map(features.map((feature) => [feature.slug, feature])), [features]);
  const usedFeatureCount = new Set(activeModule.subModules.flatMap((sub) => sub.features.map((binding) => binding.featureId))).size;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">{t('admin.catalogTitle') || 'Catálogo de Funcionalidades'}</h3>
          </div>
          <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-slate-600">
            Mapa de módulos → sub-módulos → funcionalidades. O sistema aplicou esse catálogo nas condições dos planos, sem valores codificados nas regras de negócio. Admin define o catálogo; o sistema aplica.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => setActiveModuleId('directorio')} className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">
            <Layers className="h-4 w-4" />
            {t('admin.featuredModules') || 'Módulos'}
          </Button>
        </div>
      </div>

      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-800">{notice}</div>}

      <div className="flex flex-wrap gap-2">
        {catalog.map((module) => (
          <button
            key={module.id}
            type="button"
            onClick={() => setActiveModuleId(module.id)}
            className={`rounded-xl border px-3 py-2 text-[11px] font-black uppercase tracking-wider transition ${
              activeModuleId === module.id
                ? 'border-indigo-600 bg-indigo-600/10 text-indigo-800'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 hover:border-slate-300'
            }`}
          >
            {module.name}
          </button>
        ))}
      </div>

      {activeModule && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            {activeModule.subModules.map((sub) => (
              <Card key={sub.id} className="p-4">
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3 mb-3">
                  <div>
                    <h4 className="text-sm font-black text-slate-900">{sub.name}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{sub.description}</p>
                  </div>
                  <Badge variant="neutral" className="bg-slate-100 dark:bg-slate-800 text-slate-700 border-0 text-[9px] uppercase tracking-wider px-2 py-0.5">
                    {sub.features.length} {t('admin.functions') || 'funcionalidade(s)'}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {sub.features.map((binding) => {
                    const feature = featureMap.get(binding.featureId);
                    const name = feature?.name || slugToLabel[binding.featureId] || binding.label;
                    const isActiveFeature = feature?.isActive ?? true;
                    const isEditing = editingBinding?.moduleId === activeModule.id && editingBinding?.subModuleId === sub.id && editingBinding?.featureId === binding.featureId;
                    return (
                      <div
                        key={binding.featureId}
                        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-xs transition ${
                          isEditing
                            ? 'border-indigo-300 bg-indigo-50/70'
                            : binding.active
                            ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                            : 'border-slate-100 bg-slate-50/70'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`h-2 w-2 rounded-full flex-shrink-0 ${binding.active ? 'bg-emerald-600' : 'bg-slate-300'}`} />
                          <span className="font-bold text-slate-800">{name}</span>
                          {binding.required && <Badge variant="info" className="bg-slate-900 text-white border-0 text-[9px] px-1.5 py-0.5">obrigatória</Badge>}
                          {binding.active && isActiveFeature && <Badge variant="success" className="bg-emerald-100 text-emerald-800 border-0 text-[9px] px-1.5 py-0.5">ativa</Badge>}
                          {!isActiveFeature && <Badge variant="neutral" className="bg-amber-100 text-amber-800 border-0 text-[9px] px-1.5 py-0.5">feature inactiva</Badge>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isEditing ? (
                            <>
                              <Button type="button" size="sm" variant="ghost" onClick={() => { setFeatureActive(binding.featureId, true); setEditingBinding(null); notify(`${name}: ativada no catálogo.`); }} className="text-[10px]">
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => { setFeatureActive(binding.featureId, false); setEditingBinding(null); notify(`${name}: desativada do catálogo.`); }} className="text-[10px]">
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingBinding({ moduleId: activeModule.id, subModuleId: sub.id, featureId: binding.featureId })}
                              className={`inline-flex min-h-[28px] min-w-[28px] items-center justify-center rounded-lg border text-[10px] font-black transition ${
                                binding.active
                                  ? 'border-slate-200 dark:border-slate-700 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                                  : 'border-dashed border-slate-200 dark:border-slate-700 text-slate-400 hover:border-indigo-300 hover:text-indigo-700'
                              }`}
                              title={binding.active ? 'Alterar registo no catálogo' : 'Ativar funcionalidade'}
                            >
                              {binding.active ? <Edit2 className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-4 shadow-sm">
            <h4 className="text-xs font-black uppercase tracking-wide text-slate-800">Funcionalidades disponíveis</h4>
            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
              {features
                .filter((feature) => feature.isActive)
                .map((feature) => {
                  const bound = activeModule.subModules.some((sub) => sub.features.some((binding) => binding.featureId === feature.id));
                  return (
                    <div
                      key={feature.id}
                      className={`flex items-center justify-between gap-2 rounded-lg border p-2 text-[11px] ${bound ? 'border-indigo-200 bg-indigo-50/50' : 'border-slate-100 bg-slate-50 dark:bg-slate-800'}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-800">{feature.name}</div>
                        <div className="text-[9px] text-slate-500 capitalize">{feature.type}</div>
                      </div>
                      {bound && <span className="text-[9px] font-black text-indigo-700 uppercase tracking-wider">ligado</span>}
                    </div>
                  );
                })}
            </div>
            <div className="text-[10px] text-slate-500 leading-relaxed border-t border-indigo-100 pt-3">
              {usedFeatureCount === 0 ? 'Nenhuma funcionalidade associada a este módulo.' : `${usedFeatureCount} funcionalidade(s) ativa(s) neste módulo.`}
            </div>
          </div>
        </div>
      )}

      {editingBinding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-w-sm w-full rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-sm font-black text-slate-900">Atribuir funcionalidade</h4>
              <IconButton label="Fechar" variant="secondary" size="sm" onClick={() => setEditingBinding(null)} aria-label="Fechar">
                <X className="h-4 w-4" />
              </IconButton>
            </div>
            <p className="mt-3 text-xs text-slate-600">
              Ligar ou desligar uma funcionalidade neste sub-módulo do catálogo.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditingBinding(null)} className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2 text-xs font-black text-slate-700">
                Cancelar
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={() => setEditingBinding(null)} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700">
                Guardar registo
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
