import React from 'react'
import { Building2, CalendarDays, FileText, Mail, MapPin, Phone, Share2 } from 'lucide-react'
import {
  AUDIENCE_LABELS,
  CONTACT_PURPOSE_LABELS,
  SECTION_LABELS,
  type EntityRow,
  type InstitutionalSnapshot,
} from './institutionalApi'

/** Renderiza conteúdo institucional publicado (ou a pré-visualização do rascunho). */

const Paragraphs: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph, index) => (
        <p key={index} className="text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-300">
          {paragraph}
        </p>
      ))}
  </>
)

const text = (value: unknown) => (value === undefined || value === null ? '' : String(value))

const visible = (rows: EntityRow[] | undefined) =>
  (rows ?? []).filter((row) => row.isVisible !== false)

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">{children}</h2>
}

export const InstitutionalPublicView: React.FC<{ data: InstitutionalSnapshot; preview?: boolean }> = ({
  data,
  preview = false,
}) => {
  const profile = data.profile ?? {}
  const purpose = data.purpose ?? {}
  const seo = data.seo ?? {}
  const accent = text(profile.primary_color) || '#0B3B37'

  const sections = (data.sections ?? [])
    .map((section) => ({
      key: text(section.sectionKey),
      title: text(section.title) || SECTION_LABELS[text(section.sectionKey)] || '',
      body: text(section.body),
      imageUrl: text(section.imageUrl),
      isVisible: section.isVisible !== false,
    }))
    .filter((section) => section.isVisible && (section.body || section.imageUrl))

  const values = visible(data.entities?.values)
  const timeline = visible(data.entities?.timeline)
  const objectives = visible(data.entities?.objectives)
  const team = visible(data.entities?.team)
  const departments = visible(data.entities?.departments)
  const partners = visible(data.entities?.partners)
  const contacts = visible(data.entities?.contacts)
  const socials = visible(data.entities?.social_links)
  const gallery = visible(data.entities?.gallery)
  const faq = visible(data.entities?.faq)
  const documents = visible(data.entities?.documents)

  const anchors: Array<{ id: string; label: string }> = []
  if (sections.length > 0) anchors.push({ id: 'institucional-apresentacao', label: 'Apresentação' })
  if (text(purpose.mission) || text(purpose.vision) || values.length > 0) anchors.push({ id: 'institucional-proposito', label: 'Propósito' })
  if (timeline.length > 0) anchors.push({ id: 'institucional-historia', label: 'História' })
  if (objectives.length > 0) anchors.push({ id: 'institucional-objetivos', label: 'Objetivos' })
  if (team.length > 0) anchors.push({ id: 'institucional-equipa', label: 'Equipa' })
  if (departments.length > 0) anchors.push({ id: 'institucional-areas', label: 'Áreas' })
  if (partners.length > 0) anchors.push({ id: 'institucional-parceiros', label: 'Parceiros' })
  if (gallery.length > 0) anchors.push({ id: 'institucional-galeria', label: 'Galeria' })
  if (faq.length > 0) anchors.push({ id: 'institucional-faq', label: 'FAQ' })
  if (contacts.length > 0 || socials.length > 0) anchors.push({ id: 'institucional-contactos', label: 'Contactos' })
  if (documents.length > 0) anchors.push({ id: 'institucional-documentos', label: 'Documentos' })

  return (
    <article className="space-y-8 text-slate-900 dark:text-white">
      {preview && (
        <div className="rounded-xl border border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] px-3 py-2 text-[11px] font-bold text-[var(--tone-warning-text)]">
          Pré-visualização do rascunho — este conteúdo ainda não está publicado.
        </div>
      )}

      <header
        className="rounded-3xl border border-slate-800 p-6 text-white sm:p-10"
        style={{ background: `linear-gradient(135deg, ${accent}, #0f172a)` }}
      >
        <div className="flex flex-wrap items-center gap-4">
          {text(profile.logo_url) ? (
            <img
              src={text(profile.logo_url)}
              alt={text(profile.official_name) || 'Logótipo'}
              className="h-14 w-14 rounded-2xl bg-[var(--color-green-800)] object-contain p-1.5"
            />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-green-800)]">
              <Building2 className="h-7 w-7" />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              {text(profile.official_name) || 'Guigui.com'}
            </h1>
            {text(profile.slogan) && <p className="mt-1 text-sm font-semibold text-white/80">{text(profile.slogan)}</p>}
          </div>
        </div>
        {text(profile.short_description) && (
          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-white/85">
            {text(profile.short_description)}
          </p>
        )}
        {text(profile.trade_name) && text(profile.trade_name) !== text(profile.official_name) && (
          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
            {text(profile.trade_name)}
          </p>
        )}
      </header>

      {anchors.length > 2 && (
        <nav aria-label="Secções da página institucional" className="flex flex-wrap gap-1.5">
          {anchors.map((anchor) => (
            <a
              key={anchor.id}
              href={`#${anchor.id}`}
              className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-[10.5px] font-black uppercase tracking-wide text-slate-600 transition:hover:border-slate-400:hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              {anchor.label}
            </a>
          ))}
        </nav>
      )}

      {sections.length > 0 && (
        <section id="institucional-apresentacao" className="space-y-5 scroll-mt-24">
          <SectionTitle>Quem somos</SectionTitle>
          {sections.map((section) => (
            <div
              key={section.key}
              className="grid gap-4 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-[1fr_auto]"
            >
              <div className="min-w-0 space-y-2">
                {section.title && <h3 className="text-sm font-black text-slate-900 dark:text-white">{section.title}</h3>}
                <Paragraphs text={section.body} />
              </div>
              {section.imageUrl && (
                <img
                  src={section.imageUrl}
                  alt={section.title || 'Imagem institucional'}
                  className="h-32 w-full rounded-xl object-cover sm:w-48"
                />
              )}
            </div>
          ))}
        </section>
      )}

      {(text(purpose.mission) || text(purpose.vision) || values.length > 0) && (
        <section id="institucional-proposito" className="space-y-4 scroll-mt-24">
          <SectionTitle>Missão, visão e valores</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            {text(purpose.mission) && (
              <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5 dark:border-slate-700 dark:bg-slate-900">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Missão</h3>
                <div className="mt-2 space-y-2">
                  <Paragraphs text={text(purpose.mission)} />
                </div>
              </div>
            )}
            {text(purpose.vision) && (
              <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5 dark:border-slate-700 dark:bg-slate-900">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Visão</h3>
                <div className="mt-2 space-y-2">
                  <Paragraphs text={text(purpose.vision)} />
                </div>
              </div>
            )}
          </div>
          {values.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {values.map((value) => (
                <div
                  key={value.id}
                  className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4 dark:border-slate-700 dark:bg-slate-900"
                >
                  <h3 className="text-[12.5px] font-black text-slate-900 dark:text-white">
                    {text(value.name)}
                  </h3>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                    {text(value.description)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {timeline.length > 0 && (
        <section id="institucional-historia" className="space-y-4 scroll-mt-24">
          <SectionTitle>História e trajetória</SectionTitle>
          <ol className="space-y-3">
            {timeline.map((entry) => (
              <li
                key={entry.id}
                className="relative rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4 pl-5 dark:border-slate-700 dark:bg-slate-900"
              >
                <span
                  className="absolute left-0 top-0 h-full w-1 rounded-l-2xl"
                  style={{ background: accent }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                    {text(entry.period_label) || 'Sem data'}
                  </span>
                  {text(entry.category) && (
                    <span
                      className="rounded-full bg-[var(--color-bg-subtle)] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {text(entry.category)}
                    </span>
                  )}
                </div>
                <h3 className="mt-1 text-[13px] font-black text-slate-900 dark:text-white">
                  {text(entry.title)}
                </h3>
                <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {text(entry.description)}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {objectives.length > 0 && (
        <section id="institucional-objetivos" className="space-y-4 scroll-mt-24">
          <SectionTitle>Objetivos e compromissos</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {objectives.map((objective) => (
              <div
                key={objective.id}
                className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4 dark:border-slate-700 dark:bg-slate-900"
              >
                <span
                  className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500"
                >
                  {AUDIENCE_LABELS[text(objective.audience)] || text(objective.audience)}
                </span>
                <h3 className="mt-1 text-[12.5px] font-black text-slate-900 dark:text-white">
                  {text(objective.title)}
                </h3>
                <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {text(objective.description)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {team.length > 0 && (
        <section id="institucional-equipa" className="space-y-4 scroll-mt-24">
          <SectionTitle>Equipa e organização</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((member) => (
              <div
                key={member.id}
                className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4 text-center dark:border-slate-700 dark:bg-slate-900"
              >
                {text(member.photo_url) ? (
                  <img
                    src={text(member.photo_url)}
                    alt={text(member.name)}
                    className="mx-auto h-20 w-20 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-bg-subtle)] text-lg font-black text-slate-500 dark:bg-slate-800"
                  >
                    {text(member.name).slice(0, 1).toUpperCase() || '—'}
                  </span>
                )}
                <h3 className="mt-3 text-[12.5px] font-black text-slate-900 dark:text-white">
                  {text(member.name)}
                </h3>
                <p className="text-[10.5px] font-bold text-slate-500">
                  {text(member.role_title)}
                </p>
                {text(member.department) && <p className="text-[10px] text-slate-500">{text(member.department)}</p>}
                {text(member.bio) && <p className="mt-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {text(member.bio)}
                </p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {departments.length > 0 && (
        <section id="institucional-areas" className="space-y-4 scroll-mt-24">
          <SectionTitle>Áreas de atuação</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {departments.map((area) => (
              <div
                key={area.id}
                className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4 dark:border-slate-700 dark:bg-slate-900"
              >
                <h3 className="text-[12.5px] font-black text-slate-900 dark:text-white">
                  {text(area.name)}
                </h3>
                {text(area.responsibility) && <p className="text-[10.5px] font-bold text-slate-500">
                  {text(area.responsibility)}
                </p>}
                <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {text(area.description)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {partners.length > 0 && (
        <section id="institucional-parceiros" className="space-y-4 scroll-mt-24">
          <SectionTitle>Parceiros institucionais</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {partners.map((partner) => (
              <div
                key={partner.id}
                className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4 dark:border-slate-700 dark:bg-slate-900"
              >
                {text(partner.logo_url) && (
                  <img
                    src={text(partner.logo_url)}
                    alt={text(partner.name)}
                    className="mb-3 h-12 object-contain"
                  />
                )}
                <h3 className="text-[12.5px] font-black text-slate-900 dark:text-white">
                  {text(partner.name)}
                </h3>
                <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {text(partner.description)}
                </p>
                {text(partner.website_url) && (
                  <a
                    href={text(partner.website_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-[10.5px] font-black uppercase tracking-wide text-[var(--tone-info-text)] hover:underline"
                  >
                    Website
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {gallery.length > 0 && (
        <section id="institucional-galeria" className="space-y-4 scroll-mt-24">
          <SectionTitle>Galeria</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.map((image) => (
              <figure
                key={image.id}
                className="overflow-hidden rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:border-slate-700 dark:bg-slate-900"
              >
                {text(image.file_url) && (
                  <img
                    src={text(image.file_url)}
                    alt={text(image.alt_text) || text(image.title)}
                    className="h-40 w-full object-cover"
                    loading="lazy"
                  />
                )}
                <figcaption className="p-3">
                  <span className="block text-[12px] font-black text-slate-900 dark:text-white">
                    {text(image.title)}
                  </span>
                  {text(image.description) && (
                    <span className="mt-0.5 block text-[11px] text-slate-600 dark:text-slate-300">
                      {text(image.description)}
                    </span>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {faq.length > 0 && (
        <section id="institucional-faq" className="space-y-3 scroll-mt-24">
          <SectionTitle>Perguntas frequentes</SectionTitle>
          <div className="space-y-2">
            {faq.map((item) => (
              <details
                key={item.id}
                className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4 dark:border-slate-700 dark:bg-slate-900"
              >
                <summary
                  className="cursor-pointer text-[12.5px] font-black text-slate-900 dark:text-white"
                >
                  {text(item.question)}
                </summary>
                <p className="mt-2 text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {text(item.answer)}
                </p>
              </details>
            ))}
          </div>
        </section>
      )}

      {(contacts.length > 0 || socials.length > 0) && (
        <section id="institucional-contactos" className="space-y-4 scroll-mt-24">
          <SectionTitle>Contactos</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-4 dark:border-slate-700 dark:bg-slate-900"
              >
                <span
                  className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500"
                >
                  {CONTACT_PURPOSE_LABELS[text(contact.purpose)] || 'Contacto'}
                </span>
                <h3 className="mt-1 text-[12.5px] font-black text-slate-900 dark:text-white">
                  {text(contact.label)}
                </h3>
                <ul className="mt-2 space-y-1 text-[11.5px] text-slate-600 dark:text-slate-300">
                  {text(contact.email) && (
                    <li className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" />
                      <a href={`mailto:${text(contact.email)}`} className="hover:underline">
                        {text(contact.email)}
                      </a>
                    </li>
                  )}
                  {text(contact.phone) && (
                    <li className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" />
                      <a href={`tel:${text(contact.phone)}`} className="hover:underline">
                        {text(contact.phone)}
                      </a>
                    </li>
                  )}
                  {(text(contact.address) || text(contact.city)) && (
                    <li className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>
                        {[text(contact.address), text(contact.city)].filter(Boolean).join(', ')}
                      </span>
                    </li>
                  )}
                  {text(contact.hours) && <li className="text-slate-500">{text(contact.hours)}</li>}
                </ul>
              </div>
            ))}
          </div>
          {socials.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {socials.map((social) => (
                <a
                  key={social.id}
                  href={text(social.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-[10.5px] font-black uppercase tracking-wide text-slate-700 transition:hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <Share2 className="h-3 w-3" />
                  {text(social.label) || text(social.network)}
                </a>
              ))}
            </div>
          )}
        </section>
      )}

      {documents.length > 0 && (
        <section id="institucional-documentos" className="space-y-3 scroll-mt-24">
          <SectionTitle>Documentos institucionais</SectionTitle>
          <ul className="space-y-2">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex items-start gap-3 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-3 dark:border-slate-700 dark:bg-slate-900"
              >
                <FileText className="mt-0.5 h-4 w-4 text-slate-500" />
                <div className="min-w-0">
                  <a
                    href={text(document.file_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] font-black text-slate-900 hover:underline"
                  >
                    {text(document.name)}
                  </a>
                  {text(document.description) && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      {text(document.description)}
                    </p>
                  )}
                  {text(document.document_date) && (
                    <p className="text-[10px] text-slate-500">
                      {text(document.document_date)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {text(profile.long_description) && (
        <section className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-5 dark:border-slate-700 dark:bg-slate-900">
          <SectionTitle>Sobre a plataforma</SectionTitle>
          <div className="mt-2 space-y-2">
            <Paragraphs text={text(profile.long_description)} />
          </div>
          {text(profile.platform_info) && (
            <div className="mt-3 space-y-2">
              <Paragraphs text={text(profile.platform_info)} />
            </div>
          )}
        </section>
      )}

      {seo.no_index === true && preview && (
        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--tone-warning-text)]">
          Metadados: noindex activo (a página não será indexada).
        </p>
      )}
    </article>
  )
}