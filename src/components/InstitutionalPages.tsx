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

export const InstitutionalPages: React.FC<InstitutionalPagesProps> = ({ currentLang }) => {
  const t = (key: string) => getTranslation(currentLang, key);

  const [activeSection, setActiveSection] = useState<'advertise' | 'group' | 'faq' | 'terms'>('advertise');

  const [contentBlocks, setContentBlocks] = useState<Record<string, Array<{ id: string; type: 'html' | 'list'; content: string }>>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const key of ['guigui_plans_content', 'guigui_about_content', 'guigui_faq_content', 'guigui_terms_content']) {
        try {
          const response = await fetch(`/api/app-state/${key}`);
          if (!response.ok) continue;
          const data = await response.json();
          if (!cancelled && Array.isArray(data?.value)) setContentBlocks((prev) => ({ ...prev, [key]: data.value }));
        } catch {
          // Falha silenciosa: o conteúdo pré-definido mantém a página funcional.
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Recarrega conteúdo quando o app_state sincronizado muda (outros utilizadores/abas).
  useEffect(() => {
    const handleLocalUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ value?: unknown }>).detail;
      if (!detail || !Array.isArray(detail.value)) return;

      const eventName = (event.type as string);
      const key = eventName.replace(/^guigui:persistent-state:/, '');

      setContentBlocks((prev) => ({
        ...prev,
        [key]: detail.value as Array<{ id: string; type: 'html' | 'list'; content: string }>,
      }));
    };

    window.addEventListener('guigui:persistent-state:guigui_plans_content', handleLocalUpdate);
    window.addEventListener('guigui:persistent-state:guigui_about_content', handleLocalUpdate);
    window.addEventListener('guigui:persistent-state:guigui_faq_content', handleLocalUpdate);
    window.addEventListener('guigui:persistent-state:guigui_terms_content', handleLocalUpdate);

    return () => {
      window.removeEventListener('guigui:persistent-state:guigui_plans_content', handleLocalUpdate);
      window.removeEventListener('guigui:persistent-state:guigui_about_content', handleLocalUpdate);
      window.removeEventListener('guigui:persistent-state:guigui_faq_content', handleLocalUpdate);
      window.removeEventListener('guigui:persistent-state:guigui_terms_content', handleLocalUpdate);
    };
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
      <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl text-xs font-bold border border-slate-200 dark:border-slate-700 sm:grid-cols-3 lg:grid-cols-4">
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
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Escolha o Escalão Ideal para a Sua Empresa</h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Todos os planos incluem página dedicada com geolocalização, botão directo de WhatsApp e validação SMS.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Standard Tier */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 rounded-3xl space-y-4 shadow-sm flex flex-col justify-between">
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
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 rounded-3xl space-y-4 shadow-sm flex flex-col justify-between">
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

          {activeSection === 'advertise' && sectionBlocks.advertise.length > 0 && (
            <div className="mt-8 space-y-4">
              {sectionBlocks.advertise.map((block) => (
                block.type === 'html'
                  ? <div key={block.id} className="text-xs leading-relaxed text-slate-700 dark:text-slate-200" dangerouslySetInnerHTML={{ __html: block.content }} />
                  : block.type === 'list'
                    ? <div key={block.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 text-xs">
                        {(() => {
                          try {
                            const items = JSON.parse(block.content) as Array<{ q: string; a: string }>;
                            return items.map((item, index) => (
                              <div key={index} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 sm:p-8 rounded-3xl space-y-4 shadow-sm text-xs leading-relaxed text-slate-700 dark:text-slate-200">
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
                            <div key={index} className="mt-3 border-t border-slate-200 dark:border-slate-700 pt-3">
                              <p className="font-bold text-slate-900 dark:text-white text-sm">{item.q}</p>
                              <p className="mt-1 text-slate-600 dark:text-slate-300">{item.a}</p>
                            </div>
                          ));
                        } catch {
                          return <p className="text-slate-500">Conteúdo inválido.</p>;
                        }
                      })()}
                    </div>
                  : null
            ))
          ) : (
            <>
              <p>
                O <strong>Guigui.com</strong> é a plataforma digital focada na transformação digital, tecnologia e modernização de serviços comerciais e culturais.
              </p>
              <p>
                Com o <strong>Guigui.com</strong>, disponibilizamos às empresas uma infraestrutura robusta e confiável para atração de clientes e venda de bilhetes.
              </p>
            </>
          )}
        </div>
      )}

      {/* FAQ */}
      {activeSection === 'faq' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 rounded-3xl space-y-4 shadow-sm text-xs">
          <h2 className="text-lg font-black text-slate-900 dark:text-white mb-4">Perguntas Frequentes</h2>

          {sectionBlocks.faq.length > 0 ? (
            sectionBlocks.faq.map((block) => (
              block.type === 'html'
                ? <div key={block.id} className="text-xs text-slate-700 dark:text-slate-200" dangerouslySetInnerHTML={{ __html: block.content }} />
                : block.type === 'list'
                  ? (
                      () => {
                        try {
                          const items = JSON.parse(block.content) as Array<{ q: string; a: string }>;
                          return items.map((item, index) => (
                            <div key={index} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                              <h3 className="font-bold text-slate-900 dark:text-white text-sm">{item.q}</h3>
                              <p className="text-slate-600 dark:text-slate-300 mt-1">{item.a}</p>
                            </div>
                          ));
                        } catch {
                          return <p className="text-slate-500">Conteúdo inválido.</p>;
                        }
                      })()
                  : null
            ))
          ) : (
            <div className="space-y-3">
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">Como funciona o pagamento de bilhetes?</h3>
                <p className="text-slate-600 dark:text-slate-300 mt-1">
                  Os bilhetes para eventos podem ser pagos instantaneamente via Orange Money ou Telecel. O bilhete com QR Code é enviado por SMS para o telemóvel do comprador.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">Como posso cadastrar a minha empresa em Bissau?</h3>
                <p className="text-slate-600 dark:text-slate-300 mt-1">
                  Entre em contacto com a nossa equipa comercial pelo WhatsApp (+245 955 00 00 00) para ativarmos a sua ficha verificada.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Terms */}
      {activeSection === 'terms' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 rounded-3xl space-y-4 shadow-sm text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Termos e Condições de Uso</h2>

          {sectionBlocks.terms.length > 0 ? (
            sectionBlocks.terms.map((block) => (
              block.type === 'html'
                ? <div key={block.id} className="text-xs leading-relaxed text-slate-700 dark:text-slate-200" dangerouslySetInnerHTML={{ __html: block.content }} />
                : block.type === 'list'
                  ? (
                      () => {
                        try {
                          const items = JSON.parse(block.content) as Array<{ q: string; a: string }>;
                          return items.map((item, index) => (
                            <div key={index} className="mt-3 border-t border-slate-200 dark:border-slate-700 pt-3">
                              <p className="font-bold text-slate-900 dark:text-white text-sm">{item.q}</p>
                              <p className="mt-1 text-slate-600 dark:text-slate-300">{item.a}</p>
                            </div>
                          ));
                        } catch {
                          return <p className="text-slate-500">Conteúdo inválido.</p>;
                        }
                      })()
                  : null
            ))
          ) : (
            <p>
              Todas as publicações e dados comerciais submetidos no Guigui.com estão sujeitos à moderação prévia por IA e verificação por SMS para garantir a veracidade e segurança dos utilizadores em Bissau.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
