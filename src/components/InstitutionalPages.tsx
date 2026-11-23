import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  ShieldCheck,
  CheckCircle,
  HelpCircle,
  Phone,
  MessageCircle,
  FileText,
  Sparkles,
} from 'lucide-react';
import { Language } from '../types';
import { getTranslation } from '../utils/i18n';

interface InstitutionalPagesProps {
  currentLang: Language;
}

interface InstitutionalData {
  version: number;
  profile: {
    founded_year: string;
    official_name: string;
    primary_color: string;
    secondary_color: string;
    short_description: string;
  };
  purpose: {
    vision: string;
    mission: string;
  };
  sections: {
    sectionKey: string;
    title: string;
    body: string;
    imageUrl: string;
    isVisible: boolean;
    position: number;
  }[];
  seo: {
    no_index: boolean;
    seo_title: string;
    og_imageUrl: string;
    canonical_url: string;
    meta_description: string;
  };
  entities: {
    values: {
      id: string;
      name: string;
      position: number;
      isVisible: boolean;
      description: string;
      updatedAt: string;
    }[];
    timeline: {
      id: string;
      position: number;
      isVisible: boolean;
      title: string;
      periodLabel: string;
      description: string;
      imageUrl: string;
      category: string;
      updatedAt: string;
    }[];
    objectives: {
      id: string;
      position: number;
      isVisible: boolean;
      audience: string;
      title: string;
      description: string;
      updatedAt: string;
    }[];
    team: {
      id: string;
      position: number;
      isVisible: boolean;
      name: string;
      roleTitle: string;
      bio: string;
      photoUrl: string;
      department: string;
      updatedAt: string;
    }[];
    departments: {
      id: string;
      position: number;
      isVisible: boolean;
      name: string;
      description: string;
      imageUrl: string;
      responsibility: string;
      updatedAt: string;
    }[];
    partners: {
      id: string;
      position: number;
      isVisible: boolean;
      name: string;
      logoUrl: string;
      description: string;
      websiteUrl: string;
      category: string;
      updatedAt: string;
    }[];
    contacts: {
      id: string;
      position: number;
      isVisible: boolean;
      purpose: string;
      label: string;
      email: string;
      phone: string;
      whatsapp: string;
      address: string;
      city: string;
      hours?: string;
      updatedAt: string;
    }[];
    social_links: {
      id: string;
      position: number;
      isVisible: boolean;
      network: string;
      label: string;
      url: string;
      icon: string;
      updatedAt: string;
    }[];
    gallery: {
      id: string;
      position: number;
      isVisible: boolean;
      title: string;
      description: string;
      fileUrl: string;
      altText: string;
      category: string;
      updatedAt: string;
    }[];
    faq: {
      id: string;
      position: number;
      isVisible: boolean;
      question: string;
      answer: string;
      category: string;
      updatedAt: string;
    }[];
    documents: {
      id: string;
      position: number;
      isVisible: boolean;
      name: string;
      description: string;
      fileUrl: string;
      slug?: string;
      version?: string;
      status?: string;
      content?: string;
      category: string;
      documentDate: string;
      publishedAt?: string;
      updatedAt: string;
    }[];
    services?: {
      id: string;
      position: number;
      isVisible: boolean;
      name: string;
      description: string;
      detailedDescription?: string;
      icon?: string;
      imageUrl?: string;
      category?: string;
      linkUrl?: string;
      updatedAt: string;
    }[];
    communications?: {
      id: string;
      position: number;
      isVisible: boolean;
      title: string;
      slug?: string;
      type?: string;
      body: string;
      imageUrl?: string;
      audience?: string;
      status?: string;
      publishAt?: string;
      expiresAt?: string;
      author?: string;
      updatedAt: string;
    }[];
  };
}

interface PlanTier {
  name: string;
  price: string;
  features: string[];
  ctaText: string;
  ctaHref: string;
  popular?: boolean;
}

const defaultPlans: PlanTier[] = [
  {
    name: 'Escalão Básico',
    price: '15.000 XOF/mês',
    features: [
      'Ficha com fotos e contactos',
      'Botão directo WhatsApp',
      '1 Post de marketing/mês',
    ],
    ctaText: 'Adderir por WhatsApp',
    ctaHref: 'https://wa.me/245955000000?text=Olá! Gostaria de aderir ao Escalão Básico no Guigui.com',
  },
  {
    name: 'Escalão Premium',
    price: '35.000 XOF/mês',
    features: [
      'Prioridade nas pesquisas de Bissau',
      'Promoções ilimitadas na Homepage',
      '3 Posts mensais com Moderação IA',
    ],
    ctaText: 'Aderir ao Premium',
    ctaHref: 'https://wa.me/245955000000?text=Olá! Gostaria de aderir ao Escalão Premium no Guigui.com',
    popular: true,
  },
  {
    name: 'Escalão Enterprise',
    price: '65.000 XOF/mês',
    features: [
      'Selo Oficial de Empresa Verificada',
      'Posts ilimitados e destaque principal',
      'Integração de Bilheteira de Eventos',
    ],
    ctaText: 'Falar com Gestor',
    ctaHref: 'https://wa.me/245955000000?text=Olá! Gostaria de saber mais sobre o Escalão Enterprise',
  },
];

export const InstitutionalPages: React.FC<InstitutionalPagesProps> = ({ currentLang }) => {
  const t = (key: string) => getTranslation(currentLang, key);

  const [activeSection, setActiveSection] = useState<'advertise' | 'group' | 'faq' | 'terms'>(() => (
    typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === '/sobre-nos'
      ? 'group'
      : 'advertise'
  ));

  const [contentBlocks, setContentBlocks] = useState<Record<string, Array<{ id: string; type: 'html' | 'list'; content: string }>>>({});
  const [publicServices, setPublicServices] = useState<Array<{ id: string; name: string; description: string; detailedDescription?: string; linkUrl?: string }>>([]);
  const [publicDocuments, setPublicDocuments] = useState<Array<{ id: string; name: string; description?: string; content?: string; version?: string; category?: string; fileUrl?: string; publishedAt?: string }>>([]);
  const [publicCommunications, setPublicCommunications] = useState<Array<{ id: string; title: string; type?: string; body: string; publishAt?: string; author?: string }>>([]);
  const [publicContacts, setPublicContacts] = useState<Array<{ id: string; label?: string; purpose?: string; email?: string; phone?: string; whatsapp?: string; address?: string; city?: string; hours?: string }>>([]);
  const [publicSocials, setPublicSocials] = useState<Array<{ id: string; label?: string; network?: string; url: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/institutional', {
          credentials: 'same-origin',
          headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) throw new Error('Não foi possível carregar dados institucionais');
        const payload = await response.json() as { data?: InstitutionalData };
        const data = payload.data;
        if (!data) throw new Error('Publicação institucional indisponível');

        if (cancelled) return;

        // Map institutional data to content blocks
        const mappedBlocks: Record<string, Array<{ id: string; type: 'html' | 'list'; content: string }>> = {};

        // 1. About sections (group) - map from institutional sections
        const aboutSections = data.sections.filter(s => 
          ['quem_somos', 'origem', 'contexto', 'problema', 'publico', 'papel'].includes(s.sectionKey)
        );
        if (aboutSections.length > 0) {
          mappedBlocks['guigui_about_content'] = aboutSections.map(s => ({
            id: s.sectionKey,
            type: 'html',
            content: `<h3 class="font-bold text-slate-900 dark:text-white text-sm">${s.title}</h3><p class="text-slate-600 dark:text-slate-300 mt-1">${s.body}</p>`,
          }));
        }

        // 2. Values (could be used in advertise section)
        setPublicServices(
          (data.entities.services || [])
            .filter((service) => service.isVisible !== false)
            .map((service) => ({
              id: service.id,
              name: service.name,
              description: service.description,
              detailedDescription: service.detailedDescription,
              linkUrl: service.linkUrl,
            })),
        );

        setPublicDocuments(
          (data.entities.documents || [])
            .filter((doc) => doc.isVisible !== false && (!doc.status || doc.status === 'published'))
            .map((doc) => ({
              id: doc.id,
              name: doc.name,
              description: doc.description,
              content: doc.content,
              version: doc.version,
              category: doc.category,
              fileUrl: doc.fileUrl,
              publishedAt: doc.publishedAt,
            })),
        );
        setPublicCommunications(
          (data.entities.communications || [])
            .filter((item) => item.isVisible !== false && (!item.status || item.status === 'published'))
            .map((item) => ({
              id: item.id,
              title: item.title || '',
              type: item.type,
              body: item.body || '',
              publishAt: item.publishAt,
              author: item.author,
            })),
        );
        setPublicContacts(
          (data.entities.contacts || [])
            .filter((contact) => contact.isVisible !== false)
            .map((contact) => ({
              id: contact.id,
              label: contact.label,
              purpose: contact.purpose,
              email: contact.email,
              phone: contact.phone,
              whatsapp: contact.whatsapp,
              address: contact.address,
              city: contact.city,
              hours: contact.hours,
            })),
        );
        setPublicSocials(
          (data.entities.social_links || [])
            .filter((link) => link.isVisible !== false && Boolean(link.url))
            .map((link) => ({ id: link.id, label: link.label, network: link.network, url: link.url })),
        );

        const values = data.entities.values || [];
        if (values.length > 0) {
          mappedBlocks['guigui_plans_content'] = values.map(v => ({
            id: v.id,
            type: 'html',
            content: `<div class="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-[var(--color-border-subtle)] dark:border-slate-700"><span class="font-bold text-slate-900 dark:text-white text-sm">${v.name}</span>: ${v.description}</div>`,
          }));
        }

        // 3. FAQ from institutional data
        const faqItems = data.entities.faq || [];
        if (faqItems.length > 0) {
          mappedBlocks['guigui_faq_content'] = faqItems.map(f => ({
            id: f.id,
            type: 'list',
            content: JSON.stringify(faqItems.map(fi => ({ q: fi.question, a: fi.answer }))),
          }));
        }

        // 4. SEO and profile data can be used for metadata
        // Store profile data for reference
        if (data.profile) {
          // Profile data available for metadata/SEO
        }

        setContentBlocks(mappedBlocks);
      } catch (error) {
        // Falha silenciosa: o conteúdo pré-definido mantém a página funcional
        console.error('Erro ao carregar conteúdo institucional:', error);
      }
    })();
    return () => { cancelled = true; };
  }, []);



  const sectionBlocks = useMemo(() => {
    const map: Record<'advertise' | 'group' | 'faq' | 'terms', Array<{ id: string; type: 'html' | 'list'; content: string }>> = {
      advertise: contentBlocks['guigui_plans_content'] ?? [],
      group: contentBlocks['guigui_about_content'] ?? [],
      faq: contentBlocks['guigui_faq_content'] ?? [],
      terms: contentBlocks['guigui_terms_content'] ?? [],
    };
    return map;
  }, [contentBlocks]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 text-slate-900 dark:text-white">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 text-white relative overflow-hidden shadow-md">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-1.5 bg-blue-950 text-blue-300 text-xs px-3 py-1 rounded-full border border-blue-800 font-bold">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Guigui.com</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
            Anuncie e Faça Crescer o Seu Negócio
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Cadastre a sua empresa no directório oficial mais consultado no Guigui.com. Conecte-se diariamente a milhares de clientes.
          </p>
        </div>
      </div>

      {/* Navigation Sub-Menu */}
      <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl text-xs font-bold border border-[var(--color-border-subtle)] dark:border-slate-700 sm:grid-cols-3 lg:grid-cols-4">
        <button type="button"
          onClick={() => setActiveSection('advertise')}
          className={`py-2.5 px-4 rounded-xl transition min-h-[40px] ${ activeSection === 'advertise' ? 'bg-white dark:bg-slate-900 text-blue-700 shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900' }`}
        >
          Planos e Vantagens
        </button>

        <button type="button"
          onClick={() => setActiveSection('group')}
          className={`py-2.5 px-4 rounded-xl transition min-h-[40px] ${ activeSection === 'group' ? 'bg-white dark:bg-slate-900 text-blue-700 shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900' }`}
        >
          Sobre o Guigui.com
        </button>

        <button type="button"
          onClick={() => setActiveSection('faq')}
          className={`py-2.5 px-4 rounded-xl transition min-h-[40px] ${ activeSection === 'faq' ? 'bg-white dark:bg-slate-900 text-blue-700 shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900' }`}
        >
          Perguntas Frequentes
        </button>

        <button type="button"
          onClick={() => setActiveSection('terms')}
          className={`py-2.5 px-4 rounded-xl transition min-h-[40px] ${ activeSection === 'terms' ? 'bg-white dark:bg-slate-900 text-blue-700 shadow-sm font-extrabold' : 'text-slate-600 hover:text-slate-900' }`}
        >
          Termos & Regras
        </button>
      </div>

      {/* Planos e Vantagens */}
      {activeSection === 'advertise' && (
        <div className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Escolha o Escalão Ideal para a Sua Empresa
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Todos os planos incluem página dedicada com geolocalização, botão directo de WhatsApp e validação SMS.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Standard Tier */}
            <div className="bg-white dark:bg-slate-900 border border-[var(--color-border-subtle)] dark:border-slate-700 p-6 rounded-3xl space-y-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Escalão Básico</div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">Visibilidade Local</h3>
                <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-3">
                  15.000 XOF <span className="text-xs font-normal text-slate-500 dark:text-slate-400">/mês</span>
                </div>

                <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span>Ficha com fotos e contactos</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span>Botão directo WhatsApp</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span>1 Post de marketing/mês</span>
                  </li>
                </ul>
              </div>

              <a
                href="https://wa.me/245955000000?text=Olá! Gostaria de aderir ao Escalão Básico no Guigui.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold rounded-xl text-xs text-center transition block min-h-[44px] flex items-center justify-center"
              >
                Adderir por WhatsApp
              </a>
            </div>

            {/* Premium Tier */}
            <div className="bg-white dark:bg-slate-900 border-2 border-blue-600 p-6 rounded-3xl space-y-4 shadow-md flex flex-col justify-between relative">
              <div className="absolute -top-3 right-6 bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase">
                Mais Popular
              </div>

              <div>
                <div className="text-xs font-bold text-blue-700 uppercase">Escalão Premium</div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">Destaque de Busca</h3>
                <div className="text-2xl font-black text-blue-700 font-mono mt-3">
                  35.000 XOF <span className="text-xs font-normal text-slate-500 dark:text-slate-400">/mês</span>
                </div>

                <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span>Prioridade nas pesquisas de Bissau</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span>Promoções ilimitadas na Homepage</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span>3 Posts mensais com Moderação IA</span>
                  </li>
                </ul>
              </div>

              <a
                href="https://wa.me/245955000000?text=Olá! Gostaria de aderir ao Escalão Premium no Guigui.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs text-center transition shadow-sm block min-h-[44px] flex items-center justify-center"
              >
                Aderir ao Premium
              </a>
            </div>

            {/* Enterprise Tier */}
            <div className="bg-white dark:bg-slate-900 border border-[var(--color-border-subtle)] dark:border-slate-700 p-6 rounded-3xl space-y-4 shadow-sm flex flex-col justify-between">
              <div>
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Escalão Enterprise</div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">Cobertura Total</h3>
                <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-3">
                  65.000 XOF <span className="text-xs font-normal text-slate-500 dark:text-slate-400">/mês</span>
                </div>

                <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span>Selo Oficial de Empresa Verificada</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span>Posts ilimitados e destaque principal</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span>Integração de Bilheteira de Eventos</span>
                  </li>
                </ul>
              </div>

              <a
                href="https://wa.me/245955000000?text=Olá! Gostaria de saber mais sobre o Escalão Enterprise"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold rounded-xl text-xs text-center transition block min-h-[44px] flex items-center justify-center"
              >
                Falar com Gestor
              </a>
            </div>
          </div>

          {activeSection === 'advertise' && publicServices.length > 0 && (
            <div className="mt-8 space-y-3">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Serviços e funcionalidades públicas</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {publicServices.map((service) => (
                  <div key={service.id} className="bg-white dark:bg-slate-900 border border-[var(--color-border-subtle)] dark:border-slate-700 p-4 rounded-2xl space-y-1">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">{service.name}</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{service.description}</p>
                    {service.detailedDescription ? (
                      <p className="text-[11px] text-slate-500 leading-relaxed">{service.detailedDescription}</p>
                    ) : null}
                    {service.linkUrl ? (
                      <a
                        href={service.linkUrl}
                        className="inline-block pt-1 text-[11px] font-bold text-blue-700 hover:underline"
                      >
                        Saber mais →
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'advertise' && sectionBlocks.advertise.length > 0 && (
            <div className="mt-8 space-y-4">
              {sectionBlocks.advertise.map((block) => (
                block.type === 'html'
                  ? <div key={block.id} className="text-xs leading-relaxed text-slate-700 dark:text-slate-200" dangerouslySetInnerHTML={{ __html: block.content }} />
                  : block.type === 'list'
                    ? <div key={block.id} className="rounded-2xl border border-[var(--color-border-subtle)] dark:border-slate-700 p-4 text-xs">
                      {(() => {
                        try {
                          const items = JSON.parse(block.content) as Array<{ q: string; a: string }>;
                          return items.map((item, index) => (
                            <div key={index} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-[var(--color-border-subtle)] dark:border-slate-700">
                              <h3 className="font-bold text-slate-900 dark:text-white text-sm">{item.q}</h3>
                              <p className="text-slate-600 dark:text-slate-300 mt-1">{item.a}</p>
                            </div>
                          ));
                        } catch {
                          return <p className="text-slate-500">Conteúdo inválido.</p>;
                        }
                      })()}
                    </div>
                    : null
              ))}
            </div>
          )}
        </div>
      )}

      {/* About Guigui.com */}
      {activeSection === 'group' && (
        <div className="bg-white dark:bg-slate-900 border border-[var(--color-border-subtle)] dark:border-slate-700 p-6 sm:p-8 rounded-3xl space-y-4 shadow-sm text-xs leading-relaxed text-slate-700 dark:text-slate-200">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Sobre o Guigui.com</h2>

          {sectionBlocks.group.length > 0 ? (
            sectionBlocks.group.map((block) => (
              block.type === 'html'
                ? <div key={block.id} className="text-xs leading-relaxed text-slate-700 dark:text-slate-200" dangerouslySetInnerHTML={{ __html: block.content }} />
                : block.type === 'list'
                  ? <div key={block.id} className="text-xs text-slate-600 dark:text-slate-300">
                    {(() => {
                      try {
                        const items = JSON.parse(block.content) as Array<{ q: string; a: string }>;
                        return items.map((item, index) => (
                          <div key={index} className="mt-3 border-t border-[var(--color-border-subtle)] dark:border-slate-700 pt-3">
                            <p className="font-bold text-slate-900 dark:text-white text-sm">{item.q}</p>
                            <p className="mt-1 text-slate-600 dark:text-slate-300">{item.a}</p>
                          </div>
                        ));
                      } catch {
                        return <p className="text-slate-500">Conteúdo inválido.</p>;
                      }
                    })()}
                  </div>
                  : null)
            ))
          : (
            <p className="text-slate-500">
              O conteúdo institucional ainda não foi publicado. Assim que existir uma publicação em Identidade Institucional, aparecerá aqui.
            </p>
          )}
        </div>
      )}

      {activeSection === 'group' && (publicCommunications.length > 0 || publicContacts.length > 0) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {publicCommunications.length > 0 ? (
            <div className="rounded-3xl border border-[var(--color-border-subtle)] bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-base font-black text-slate-900 dark:text-white">Comunicação institucional</h2>
              <ul className="mt-3 space-y-3">
                {publicCommunications.slice(0, 5).map((item) => (
                  <li key={item.id} className="rounded-2xl border border-[var(--color-border-subtle)] p-3 dark:border-slate-700">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-[13px] font-black text-slate-900 dark:text-white">{item.title}</h3>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        {item.type || 'comunicado'}{item.publishAt ? ` · ${item.publishAt}` : ''}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300">{item.body}</p>
                    {item.author ? <p className="mt-1 text-[10px] text-slate-500">{item.author}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {publicContacts.length > 0 ? (
            <div className="rounded-3xl border border-[var(--color-border-subtle)] bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-base font-black text-slate-900 dark:text-white">Contactos oficiais</h2>
              <ul className="mt-3 space-y-2 text-[11.5px] text-slate-700 dark:text-slate-200">
                {publicContacts.map((contact) => (
                  <li key={contact.id} className="rounded-2xl border border-[var(--color-border-subtle)] p-3 dark:border-slate-700">
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{contact.label || contact.purpose || 'Contacto'}</p>
                    {contact.email ? <p><a className="hover:underline" href={`mailto:${contact.email}`}>{contact.email}</a></p> : null}
                    {contact.phone ? <p><a className="hover:underline" href={`tel:${contact.phone.replace(/\s+/g, '')}`}>{contact.phone}</a></p> : null}
                    {contact.whatsapp ? (
                      <p><a className="hover:underline" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${contact.whatsapp.replace(/[^0-9]/g, '')}`}>WhatsApp {contact.whatsapp}</a></p>
                    ) : null}
                    {contact.address ? <p className="text-slate-500">{[contact.address, contact.city].filter(Boolean).join(' · ')}</p> : null}
                    {contact.hours ? <p className="text-slate-500">{contact.hours}</p> : null}
                  </li>
                ))}
              </ul>
              {publicSocials.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {publicSocials.map((link) => (
                    <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[var(--color-border-subtle)] px-2.5 py-1 text-[10.5px] font-bold text-slate-700 transition hover:border-blue-500 hover:text-blue-700 dark:border-slate-700 dark:text-slate-200">
                      {link.label || link.network}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {/* FAQ */}
      {activeSection === 'faq' && (
        <div className="bg-white dark:bg-slate-900 border border-[var(--color-border-subtle)] dark:border-slate-700 p-6 rounded-3xl space-y-4 shadow-sm text-xs">
          <h2 className="text-lg font-black text-slate-900 dark:text-white mb-4">Perguntas Frequentes</h2>

          {sectionBlocks.faq.length > 0 ? (
            sectionBlocks.faq.map((block) => (
              block.type === 'html'
                ? <div key={block.id} className="text-xs text-slate-700 dark:text-slate-200" dangerouslySetInnerHTML={{ __html: block.content }} />
                : block.type === 'list'
                  ? (() => {
                      try {
                        const items = JSON.parse(block.content) as Array<{ q: string; a: string }>;
                        return items.map((item, index) => (
                          <div key={index} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-[var(--color-border-subtle)] dark:border-slate-700">
                            <h3 className="font-bold text-slate-900 dark:text-white text-sm">{item.q}</h3>
                            <p className="text-slate-600 dark:text-slate-300 mt-1">{item.a}</p>
                          </div>
                        ));
                      } catch {
                        return <p className="text-slate-500">Conteúdo inválido.</p>;
                      }
                    })()
                  : null)
          )) : (
            <p className="text-slate-500">Ainda não existem perguntas frequentes publicadas.</p>
          )}
        </div>
      )}

      {/* Terms */}
      {activeSection === 'terms' && (
        <div className="bg-white dark:bg-slate-900 border border-[var(--color-border-subtle)] dark:border-slate-700 p-6 rounded-3xl space-y-4 shadow-sm text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Termos e Condições de Uso</h2>

          {publicDocuments.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-[11px] font-black uppercase tracking-wide text-slate-500">Documentos oficiais</h3>
              {publicDocuments.map((doc) => (
                <details key={doc.id} className="rounded-2xl border border-[var(--color-border-subtle)] p-3 dark:border-slate-700">
                  <summary className="cursor-pointer text-[12px] font-black text-slate-900 dark:text-white">
                    {doc.name}
                    {doc.version ? <span className="ml-2 text-[10px] font-bold text-slate-500">v{doc.version}</span> : null}
                  </summary>
                  {doc.description ? <p className="mt-2 text-[11.5px] text-slate-600 dark:text-slate-300">{doc.description}</p> : null}
                  {doc.content ? (
                    <p className="mt-2 whitespace-pre-line text-[11.5px] leading-relaxed text-slate-700 dark:text-slate-200">{doc.content}</p>
                  ) : null}
                  {doc.fileUrl ? (
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[11px] font-bold text-blue-700 hover:underline">
                      Abrir documento (PDF)
                    </a>
                  ) : null}
                  {doc.publishedAt ? <p className="mt-1 text-[10px] text-slate-500">Publicado em {doc.publishedAt}</p> : null}
                </details>
              ))}
            </div>
          ) : null}

          {sectionBlocks.terms.length > 0 ? (
            sectionBlocks.terms.map((block) => (
              block.type === 'html'
                ? <div key={block.id} className="text-xs leading-relaxed text-slate-700 dark:text-slate-200" dangerouslySetInnerHTML={{ __html: block.content }} />
                : block.type === 'list'
                  ? (() => {
                      try {
                        const items = JSON.parse(block.content) as Array<{ q: string; a: string }>;
                        return items.map((item, index) => (
                          <div key={index} className="mt-3 border-t border-[var(--color-border-subtle)] dark:border-slate-700 pt-3">
                            <p className="font-bold text-slate-900 dark:text-white text-sm">{item.q}</p>
                            <p className="mt-1 text-slate-600 dark:text-slate-300">{item.a}</p>
                          </div>
                        ));
                      } catch {
                        return <p className="text-slate-500">Conteúdo inválido.</p>;
                      }
                    })()
                  : null)
          )) : (
            <p className="text-slate-500">Ainda não existem termos publicados.</p>
          )}
        </div>
      )}
    </div>
  );
};