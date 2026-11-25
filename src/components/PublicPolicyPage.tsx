import React, { useMemo } from 'react';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';
import { Footer } from './Footer';
import type { Language } from '../types';
import { useInstitutionalPublic } from '../hooks/useInstitutionalPublic';

/**
 * Páginas públicas de políticas.
 *
 * Consomem exclusivamente a última publicação institucional
 * (`GET /api/institutional`), pelo que um documento em rascunho nunca aparece
 * aqui. O conteúdo apresentado é o texto real guardado no módulo Identidade
 * Institucional, com título, versão e datas.
 */

const POLICY_BASE = '/politicas';

function readSlug(): string {
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path === POLICY_BASE) return '';
  const raw = path.slice(POLICY_BASE.length + 1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function policyHref(slug: string | undefined, id: string | number): string {
  return `${POLICY_BASE}/${encodeURIComponent(slug || String(id))}`;
}

function formatDate(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('pt-PT');
}

export const PublicPolicyPage: React.FC<{ currentLang: Language }> = ({ currentLang }) => {
  const slug = useMemo(readSlug, []);
  const { data, loading } = useInstitutionalPublic();
  // Sem publicação (ou falha de rede) o hook devolve `null`.
  const unavailable = !loading && data === null;

  const documents = data?.documents ?? [];
  const document = slug
    ? documents.find((item) => (item.slug && item.slug === slug) || String(item.id) === slug)
    : undefined;

  return (
    <div className="min-h-screen bg-[var(--color-bg-canvas)] text-slate-900 dark:text-white">
      <header className="border-b border-[var(--color-border-subtle)] bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <a href="/" className="flex items-center gap-2 font-extrabold">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-sm text-white" aria-hidden="true">G</span>
            Guigui<span className="text-blue-600">.com</span>
          </a>
          <a
            href="/sobre-nos"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border-subtle)] px-3 py-1.5 text-[11px] font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Sobre o Guigui.com
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {loading ? (
          <p className="text-[12px] font-bold text-slate-500">A carregar documentos oficiais…</p>
        ) : null}

        {unavailable ? (
          <div className="rounded-2xl border border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] p-4 text-[12px] font-bold text-[var(--tone-warning-text)]">
            As políticas institucionais não estão publicadas neste momento. Consulte novamente mais tarde.
          </div>
        ) : null}

        {!loading && !unavailable && documents.length === 0 ? (
          <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-white p-6 text-[12px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Ainda não existem políticas publicadas. Quando a equipa publicar documentos legais, ficam disponíveis aqui.
          </div>
        ) : null}

        {!loading && !unavailable && documents.length > 0 && !slug ? (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-black">Políticas e documentos legais</h1>
              <p className="mt-1 text-[12px] text-slate-600 dark:text-slate-300">
                Documentos oficiais publicados pelo Guigui.com. Só aparecem versões publicadas.
              </p>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {documents.map((item) => (
                <li key={item.id}>
                  <a
                    href={policyHref(item.slug, item.id)}
                    className="flex h-full flex-col gap-1 rounded-2xl border border-[var(--color-border-subtle)] bg-white p-4 transition hover:border-blue-500 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <span className="flex items-center gap-1.5 text-[12.5px] font-black">
                      <FileText className="h-3.5 w-3.5 text-blue-600" /> {item.name}
                    </span>
                    {item.description ? (
                      <span className="text-[11px] text-slate-600 dark:text-slate-300">{item.description}</span>
                    ) : null}
                    <span className="mt-auto flex flex-wrap gap-x-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      {item.version ? <span>v{item.version}</span> : null}
                      {item.category ? <span>{item.category}</span> : null}
                      {item.publishedAt || item.documentDate ? <span>{formatDate(item.publishedAt || item.documentDate)}</span> : null}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!loading && !unavailable && slug && !document ? (
          <div className="space-y-2 rounded-2xl border border-[var(--color-border-subtle)] bg-white p-6 text-[12px] dark:border-slate-700 dark:bg-slate-900">
            <h1 className="text-base font-black">Documento não encontrado</h1>
            <p className="text-slate-600 dark:text-slate-300">
              Este documento não existe ou ainda não foi publicado.{' '}
              <a className="font-bold text-blue-700 hover:underline dark:text-blue-300" href={POLICY_BASE}>
                Ver todos os documentos
              </a>
            </p>
          </div>
        ) : null}

        {!loading && document ? (
          <article className="space-y-4">
            <div>
              <a className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:underline dark:text-blue-300" href={POLICY_BASE}>
                <ArrowLeft className="h-3 w-3" /> Todas as políticas
              </a>
              <h1 className="mt-2 flex items-start gap-2 text-2xl font-black">
                <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />
                {document.name}
              </h1>
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {document.version ? <span>Versão {document.version}</span> : null}
                {document.category ? <span>{document.category}</span> : null}
                {document.publishedAt ? <span>Publicado em {formatDate(document.publishedAt)}</span> : null}
                {document.documentDate ? <span>Documento de {formatDate(document.documentDate)}</span> : null}
              </p>
            </div>

            {document.description ? (
              <p className="rounded-2xl border border-[var(--color-border-subtle)] bg-white p-4 text-[12px] font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                {document.description}
              </p>
            ) : null}

            <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-white p-5 text-[12.5px] leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {document.content ? (
                // Texto simples com quebras de linha preservadas: o conteúdo é
                // administrativo e nunca é interpretado como HTML.
                <div className="space-y-3 whitespace-pre-line">{document.content}</div>
              ) : (
                <p className="text-slate-500">
                  O texto deste documento ainda não está disponível nesta página. Consulte o ficheiro oficial abaixo.
                </p>
              )}
            </div>

            {document.fileUrl ? (
              <a
                href={document.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border-subtle)] px-3 py-2 text-[11px] font-bold text-blue-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-blue-300 dark:hover:bg-slate-800"
              >
                <FileText className="h-3.5 w-3.5" /> Abrir ficheiro oficial
              </a>
            ) : null}

            {documents.length > 1 ? (
              <nav aria-label="Outras políticas" className="border-t border-[var(--color-border-subtle)] pt-3 dark:border-slate-700">
                <h2 className="text-[10px] font-black uppercase tracking-wide text-slate-500">Outros documentos</h2>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {documents
                    .filter((item) => String(item.id) !== String(document.id))
                    .map((item) => (
                      <li key={item.id}>
                        <a
                          href={policyHref(item.slug, item.id)}
                          className="rounded-lg border border-[var(--color-border-subtle)] px-2 py-1 text-[11px] font-bold text-slate-700 transition hover:border-blue-500 dark:border-slate-700 dark:text-slate-200"
                        >
                          {item.name}
                        </a>
                      </li>
                    ))}
                </ul>
              </nav>
            ) : null}
          </article>
        ) : null}
      </main>

      <Footer
        currentLang={currentLang}
        currentRole="user"
        onTabChange={(tab) => {
          window.location.href = tab === 'institutional' ? '/sobre-nos' : '/';
        }}
      />
    </div>
  );
};
