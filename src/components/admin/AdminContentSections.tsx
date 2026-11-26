import React, { useEffect, useMemo, useState } from 'react';
import { Save, FileText, HelpCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { Button, Card, Panel, PanelHeader, Badge } from '../../ui';
import { usePersistentState } from '../../utils/persistentState';
import { getTranslation } from '../../utils/i18n';
import { Language } from '../../types';

export type ContentSectionKey = 'plans' | 'about' | 'faq' | 'terms';

export interface ContentSection {
  key: ContentSectionKey;
  titleKey: string;
  blocks: ContentBlock[];
}

export interface ContentBlock {
  id: string;
  type: 'html' | 'list';
  content: string;
}

const DEFAULT_PLANS_BLOCKS: ContentBlock[] = [
  {
    id: 'plans-intro',
    type: 'html',
    content: `<p class="text-xs text-slate-600 dark:text-slate-300 mb-4">Edite a introdução e os detalhes dos planos abaixo. Os blocos são renderizados como HTML simples.</p>`,
  },
];

const DEFAULT_ABOUT_BLOCKS: ContentBlock[] = [
  {
    id: 'about-1',
    type: 'html',
    content: `<p>O <strong>Guigui.com</strong> é a plataforma digital focada na transformação digital, tecnologia e modernização de serviços comerciais e culturais.</p><p>Com o <strong>Guigui.com</strong>, disponibilizamos às empresas uma infraestrutura robusta e confiável para atração de clientes e venda de bilhetes.</p>`,
  },
];

const DEFAULT_FAQ_BLOCKS: ContentBlock[] = [
  {
    id: 'faq-1',
    type: 'list',
    content: JSON.stringify([
      { q: 'Como funciona o pagamento de bilhetes?', a: 'Os bilhetes para eventos podem ser pagos instantaneamente via Orange Money ou Telecel. O bilhete com QR Code é enviado por SMS para o telemóvel do comprador.' },
      { q: 'Como posso cadastrar a minha empresa em Bissau?', a: 'Entre em contacto com a nossa equipa comercial pelo WhatsApp (+245 955 00 00 00) para ativarmos a sua ficha verificada.' },
    ]),
  },
];

const DEFAULT_TERMS_BLOCKS: ContentBlock[] = [
  {
    id: 'terms-1',
    type: 'html',
    content: `<p>Todas as publicações e dados comerciais submetidos no Guigui.com estão sujeitos à moderação prévia por IA e verificação por SMS para garantir a veracidade e segurança dos utilizadores em Bissau.</p>`,
  },
];

const SECTION_DEFAULTS: Record<ContentSectionKey, ContentBlock[]> = {
  plans: DEFAULT_PLANS_BLOCKS,
  about: DEFAULT_ABOUT_BLOCKS,
  faq: DEFAULT_FAQ_BLOCKS,
  terms: DEFAULT_TERMS_BLOCKS,
};

const SECTION_LABELS: Record<Language, Record<ContentSectionKey, string>> = {
  pt: {
    plans: 'Planos e Vantagens',
    about: 'Sobre o Guigui.com',
    faq: 'Perguntas Frequentes',
    terms: 'Termos & Regras',
  },
  en: {
    plans: 'Plans & Benefits',
    about: 'About Guigui.com',
    faq: 'Frequently Asked Questions',
    terms: 'Terms & Rules',
  },
  fr: {
    plans: 'Forfaits et Avantages',
    about: 'À propos de Guigui.com',
    faq: 'Foire Aux Questions',
    terms: 'Conditions & Règles',
  },
  es: {
    plans: 'Planes y Ventajas',
    about: 'Sobre Guigui.com',
    faq: 'Preguntas Frecuentes',
    terms: 'Términos y Normas',
  },
};

export const AdminContentSections: React.FC<{
  currentLang: Language;
  onSaved?: () => void;
}> = ({ currentLang, onSaved }) => {
  const t = (key: string) => getTranslation(currentLang, key);
  const sectionLabel = (key: ContentSectionKey) => SECTION_LABELS[currentLang][key];

  const [activeSection, setActiveSection] = useState<ContentSectionKey>('plans');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [blocks, setBlocks] = usePersistentState<Record<ContentSectionKey, ContentBlock[]>>(
    'guigui_admin_content_sections',
    {
      plans: SECTION_DEFAULTS.plans,
      about: SECTION_DEFAULTS.about,
      faq: SECTION_DEFAULTS.faq,
      terms: SECTION_DEFAULTS.terms,
    }
  );

  const currentBlocks = blocks[activeSection];

  useEffect(() => {
    setSaved(false);
  }, [activeSection]);

  const saveSection = async (section: ContentSectionKey, nextBlocks: ContentBlock[]) => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ section, blocks: nextBlocks }),
      });
      if (!response.ok) throw new Error('Não foi possível guardar a secção.');
      setBlocks((prev) => ({ ...prev, [section]: nextBlocks }));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
      onSaved?.();
    } catch {
      // Permanece no estado atual em caso de falha; sem alteração silenciosa.
    } finally {
      setSaving(false);
    }
  };

  const updateBlock = (section: ContentSectionKey, blockId: string, next: Partial<ContentBlock>) => {
    const updated = currentBlocks.map((block) => (block.id === blockId ? { ...block, ...next } : block));
    setBlocks((prev) => ({ ...prev, [section]: updated }));
  };

  const addBlock = (section: ContentSectionKey, type: ContentBlock['type']) => {
    const id = `block-${Date.now()}`;
    const content = type === 'list' ? JSON.stringify([{ q: 'Nova pergunta', a: 'Nova resposta' }]) : '';
    const newBlock: ContentBlock = { id, type, content };
    const updated = [...currentBlocks, newBlock];
    setBlocks((prev) => ({ ...prev, [section]: updated }));
    saveSection(section, updated);
  };

  const removeBlock = (section: ContentSectionKey, blockId: string) => {
    const updated = currentBlocks.filter((block) => block.id !== blockId);
    setBlocks((prev) => ({ ...prev, [section]: updated }));
    saveSection(section, updated);
  };

  const reorderBlocks = (section: ContentSectionKey, startIndex: number, endIndex: number) => {
    const reordered = [...currentBlocks];
    const [moved] = reordered.splice(startIndex, 1);
    reordered.splice(endIndex, 0, moved);
    setBlocks((prev) => ({ ...prev, [section]: reordered }));
    saveSection(section, reordered);
  };

  const faqItems = useMemo(() => {
    try {
      return currentBlocks.filter((block) => block.type === 'list').flatMap((block) => {
        const parsed = JSON.parse(block.content) as Array<{ q: string; a: string }>;
        return Array.isArray(parsed) ? parsed : [];
      });
    } catch {
      return [];
    }
  }, [currentBlocks]);

  return (
    <div className="space-y-5">
      <PanelHeader
        title={t('adminNavContent')}
        description={t('adminContentHelp')}
        actions={
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={saving}
            disabled={saving}
            onClick={() => saveSection(activeSection, currentBlocks)}
            className="gap-2"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {saved ? t('saved') : t('save')}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(['plans', 'about', 'faq', 'terms'] as ContentSectionKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveSection(key)}
            className={`rounded-2xl border p-3 text-left transition ${
              activeSection === key
                ? 'border-[var(--color-green-600)] bg-[var(--color-green-600)] text-white shadow-[0_18px_28px_-20px_rgba(63,174,128,0.75)]'
                : 'border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 text-[var(--color-text-strong)] hover:border-[var(--color-border-strong)]'
            }`}
          >
            <div className="flex items-center gap-2">
              {key === 'plans' && <Sparkles className="h-4 w-4" aria-hidden="true" />}
              {key === 'about' && <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
              {key === 'faq' && <HelpCircle className="h-4 w-4" aria-hidden="true" />}
              {key === 'terms' && <FileText className="h-4 w-4" aria-hidden="true" />}
              <span className="text-xs font-black">{sectionLabel(key)}</span>
            </div>
            <div className="mt-1 text-[10px] font-semibold text-[var(--color-text-muted)]">
              {currentBlocks.length} bloco(s)
            </div>
          </button>
        ))}
      </div>

      <Card className="border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-[var(--color-text-strong)]">
              {sectionLabel(activeSection)}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
              Edite o conteúdo exibido nas páginas institucionais.
            </p>
          </div>
          <Badge variant="neutral" className="border-0 px-2 py-1 text-[9px] uppercase">
            {activeSection === 'plans' ? 'Plans' : activeSection === 'about' ? 'About' : activeSection === 'faq' ? 'FAQ' : 'Terms'}
          </Badge>
        </div>

        <div className="space-y-4">
          {currentBlocks.map((block, index) => (
            <div key={block.id} className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-4 dark:bg-slate-800/60">
              <div className="mb-3 flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={block.id}
                  readOnly
                  className="w-40 rounded-lg border-0 bg-transparent px-2 py-1 text-[10px] font-mono text-[var(--color-text-muted)]"
                  aria-label="Identificador do bloco"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => removeBlock(activeSection, block.id)}
                    className="h-7 text-[10px] px-2"
                  >
                    Remover
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const next = { ...block, content: block.content + '\n' };
                      updateBlock(activeSection, block.id, { content: next.content });
                      saveSection(activeSection, currentBlocks.map((b) => (b.id === block.id ? next : b)));
                    }}
                    className="h-7 text-[10px] px-2"
                  >
                    Anexar linha
                  </Button>
                </div>
              </div>

              {block.type === 'html' ? (
                <textarea
                  value={block.content}
                  onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => updateBlock(activeSection, block.id, { content: event.target.value })}
                  onBlur={(event: React.FocusEvent<HTMLTextAreaElement>) => saveSection(activeSection, currentBlocks.map((b) => (b.id === block.id ? { ...b, content: event.target.value } : b)))}
                  className="w-full min-h-[140px] rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 px-3 py-2 text-xs font-mono leading-relaxed"
                  placeholder="Conteúdo HTML simples"
                />
              ) : (
                <div className="space-y-3">
                  {faqItems.length > 0 ? (
                    faqItems.map((item, itemIndex) => (
                      <div key={itemIndex} className="space-y-2">
                        <input
                          type="text"
                          value={item.q}
                          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                            const updated = faqItems.map((it, i) => (i === itemIndex ? { ...it, q: event.target.value } : it));
                            const blockIndex = currentBlocks.findIndex((b) => b.type === 'list');
                            if (blockIndex >= 0) {
                              updateBlock(activeSection, currentBlocks[blockIndex].id, { content: JSON.stringify(updated) });
                              saveSection(activeSection, currentBlocks.map((b, i) => (i === blockIndex ? { ...b, content: JSON.stringify(updated) } : b)));
                            }
                          }}
                          className="w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 px-3 py-2 text-xs font-bold text-[var(--color-text-strong)]"
                          placeholder="Pergunta"
                        />
                        <textarea
                          value={item.a}
                          onChange={(event) => {
                            const updated = faqItems.map((it, i) => (i === itemIndex ? { ...it, a: event.target.value } : it));
                            const blockIndex = currentBlocks.findIndex((b) => b.type === 'list');
                            if (blockIndex >= 0) {
                              updateBlock(activeSection, currentBlocks[blockIndex].id, { content: JSON.stringify(updated) });
                              saveSection(activeSection, currentBlocks.map((b, i) => (i === blockIndex ? { ...b, content: JSON.stringify(updated) } : b)));
                            }
                          }}
                          className="w-full min-h-[60px] rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 px-3 py-2 text-xs leading-relaxed text-[var(--color-text-muted)]"
                          placeholder="Resposta"
                        />
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[var(--color-text-muted)]">Sem itens de FAQ nesta secção.</p>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const faqBlockId = currentBlocks.find((b) => b.type === 'list')?.id || `faq-${Date.now()}`;
                      const existingFaqBlock = currentBlocks.find((b) => b.type === 'list');
                      if (existingFaqBlock) {
                        const updated = [...faqItems, { q: 'Nova pergunta', a: 'Nova resposta' }];
                        updateBlock(activeSection, existingFaqBlock.id, { content: JSON.stringify(updated) });
                        saveSection(activeSection, currentBlocks.map((b) => (b.id === existingFaqBlock.id ? { ...b, content: JSON.stringify(updated) } : b)));
                      } else {
                        addBlock(activeSection, 'list');
                      }
                    }}
                    className="border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)] hover:border-[var(--color-border-strong)]"
                  >
                    Adicionar pergunta
                  </Button>
                </div>
              )}
            </div>
          ))}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => addBlock(activeSection, 'html')}
            className="border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 text-[var(--color-text-muted)] dark:text-[var(--color-text-muted-dark)] hover:border-[var(--color-border-strong)]"
          >
            Adicionar bloco HTML
          </Button>
        </div>
      </Card>
    </div>
  );
};
