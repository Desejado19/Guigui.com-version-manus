/** 
 * Modelo do módulo institucional "Sobre Nós". 
 * 
 * Este ficheiro é puro (sem base de dados nem Express): define os tipos de 
 * conteúdo, a validação de campos e a composição do documento publicado. 
 * O servidor e os testes usam exactamente as mesmas regras, para que uma 
 * alteração de validação não fique só num dos lados. 
 */ 

import { normaliseAndValidateEmail } from '../../shared/emailAddress';

export const INSTITUTIONAL_SLUG = 'guigui-com';

export type FieldType = 
  | 'text' 
  | 'textarea' 
  | 'url' 
  | 'email' 
  | 'date' 
  | 'enum' 
  | 'color' 
  | 'year' 
  | 'boolean';

export interface FieldSpec {
  type: FieldType;
  max?: number;
  values?: readonly string[];
  required?: boolean;
}

export interface EntitySpec {
  table: string;
  label: string;
  singular: string;
  fields: Record<string, FieldSpec>;
}

export const ENTITY_SPECS = {
  values: {
    table: 'institutional_values',
    label: 'Valores',
    singular: 'valor',
    fields: {
      name: { type: 'text', max: 80 },
      description: { type: 'textarea', max: 500 },
      icon: { type: 'text', max: 40 },
    },
  },
  timeline: {
    table: 'institutional_timeline',
    label: 'História e Trajetória',
    singular: 'etapa',
    fields: {
      title: { type: 'text', max: 120 },
      period_label: { type: 'text', max: 60 },
      description: { type: 'textarea', max: 1500 },
      image_url: { type: 'url' },
      category: { type: 'text', max: 60 },
    },
  },
  objectives: {
    table: 'institutional_objectives',
    label: 'Objetivos e Compromissos',
    singular: 'objetivo',
    fields: {
      audience: {
        type: 'enum',
        values: [
          'citizens',
          'businesses',
          'organizers',
          'partners',
          'quality',
          'accessibility',
          'transparency',
          'community',
        ],
      },
      title: { type: 'text', max: 120 },
      description: { type: 'textarea', max: 1000 },
    },
  },
  team: {
    table: 'institutional_team',
    label: 'Equipa e Organização',
    singular: 'membro',
    fields: {
      name: { type: 'text', max: 120 },
      role_title: { type: 'text', max: 120 },
      bio: { type: 'textarea', max: 1000 },
      photo_url: { type: 'url' },
      department: { type: 'text', max: 80 },
    },
  },
  departments: {
    table: 'institutional_departments',
    label: 'Departamentos e Áreas de Atuação',
    singular: 'área',
    fields: {
      name: { type: 'text', max: 120 },
      description: { type: 'textarea', max: 1000 },
      image_url: { type: 'url' },
      responsibility: { type: 'text', max: 160 },
    },
  },
  partners: {
    table: 'institutional_partners',
    label: 'Parceiros Institucionais',
    singular: 'parceiro',
    fields: {
      name: { type: 'text', max: 120 },
      logo_url: { type: 'url' },
      description: { type: 'textarea', max: 800 },
      website_url: { type: 'url' },
      category: { type: 'text', max: 60 },
    },
  },
  contacts: {
    table: 'institutional_contacts',
    label: 'Contactos Institucionais',
    singular: 'contacto',
    fields: {
      purpose: { type: 'enum', values: ['institutional', 'support', 'commercial', 'press'] },
      label: { type: 'text', max: 120 },
      email: { type: 'email' },
      phone: { type: 'text', max: 40 },
      whatsapp: { type: 'text', max: 40 },
      address: { type: 'text', max: 240 },
      city: { type: 'text', max: 80 },
      hours: { type: 'text', max: 160 },
    },
  },
  social_links: {
    table: 'institutional_social_links',
    label: 'Redes Sociais',
    singular: 'canal',
    fields: {
      network: { type: 'text', max: 40 },
      label: { type: 'text', max: 80 },
      url: { type: 'url' },
      icon: { type: 'text', max: 40 },
    },
  },
  gallery: {
    table: 'institutional_gallery',
    label: 'Galeria Institucional',
    singular: 'imagem',
    fields: {
      title: { type: 'text', max: 120 },
      description: { type: 'textarea', max: 400 },
      file_url: { type: 'url' },
      alt_text: { type: 'text', max: 160 },
      category: { type: 'text', max: 60 },
    },
  },
  faq: {
    table: 'institutional_faq',
    label: 'FAQ Institucional',
    singular: 'pergunta',
    fields: {
      question: { type: 'text', max: 200 },
      answer: { type: 'textarea', max: 2000 },
      category: { type: 'text', max: 60 },
    },
  },
  documents: {
    table: 'institutional_documents',
    label: 'Políticas e Documentos Legais',
    singular: 'documento',
    fields: {
      name: { type: 'text', max: 160, required: true },
      slug: { type: 'text', max: 80 },
      description: { type: 'textarea', max: 600 },
      content: { type: 'textarea', max: 20000 },
      version: { type: 'text', max: 20 },
      status: { type: 'enum', values: ['draft', 'published', 'archived'] },
      category: { type: 'text', max: 60 },
      file_url: { type: 'url' },
      document_date: { type: 'date' },
      published_at: { type: 'date' },
    },
  },
  services: {
    table: 'institutional_services',
    label: 'Serviços e Funcionalidades',
    singular: 'serviço',
    fields: {
      name: { type: 'text', max: 160, required: true },
      description: { type: 'textarea', max: 600 },
      detailed_description: { type: 'textarea', max: 4000 },
      icon: { type: 'text', max: 40 },
      image_url: { type: 'url' },
      category: { type: 'text', max: 60 },
      link_url: { type: 'text', max: 2048 },
    },
  },
  communications: {
    table: 'institutional_communications',
    label: 'Comunicação Institucional',
    singular: 'conteúdo',
    fields: {
      title: { type: 'text', max: 200, required: true },
      slug: { type: 'text', max: 80 },
      type: {
        type: 'enum',
        values: ['comunicado', 'novidade', 'anuncio', 'atualizacao', 'aviso', 'manutencao'],
      },
      body: { type: 'textarea', max: 20000 },
      image_url: { type: 'url' },
      audience: {
        type: 'enum',
        values: ['all', 'citizens', 'businesses', 'organizers', 'partners', 'press'],
      },
      status: { type: 'enum', values: ['draft', 'scheduled', 'published', 'archived'] },
      publish_at: { type: 'date' },
      expires_at: { type: 'date' },
      author: { type: 'text', max: 120 },
    },
  },
  assets: {
    table: 'institutional_assets',
    label: 'Identidade Visual e Media',
    singular: 'ativo',
    fields: {
      asset_kind: {
        type: 'enum',
        values: ['logo', 'logo_dark', 'logo_light', 'favicon', 'icon', 'cover', 'institutional', 'about', 'other'],
      },
      label: { type: 'text', max: 120 },
      url: { type: 'url' },
      mime_type: { type: 'text', max: 80 },
      size_bytes: { type: 'text', max: 20 },
    },
  },
} as const satisfies Record<string, EntitySpec>;

export type EntityKind = keyof typeof ENTITY_SPECS;

export const ENTITY_KINDS = Object.keys(ENTITY_SPECS) as EntityKind[];

export function isEntityKind(value: unknown): value is EntityKind {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ENTITY_SPECS, value);
}

export const PROFILE_FIELDS: Record<string, FieldSpec> = {
  official_name: { type: 'text', max: 120 },
  trade_name: { type: 'text', max: 120 },
  slogan: { type: 'text', max: 160 },
  short_description: { type: 'textarea', max: 300 },
  long_description: { type: 'textarea', max: 4000 },
  platform_info: { type: 'textarea', max: 4000 },
  logo_url: { type: 'url' },
  favicon_url: { type: 'url' },
  share_image_url: { type: 'url' },
  primary_color: { type: 'color' },
  secondary_color: { type: 'color' },
  founded_year: { type: 'year' },
  domain: { type: 'text', max: 160 },
  country: { type: 'text', max: 80 },
  category: { type: 'text', max: 80 },
  primary_language: { type: 'text', max: 40 },
  supported_languages: { type: 'text', max: 160 },
  launch_date: { type: 'date' },
};

export const PURPOSE_FIELDS: Record<string, FieldSpec> = {
  mission: { type: 'textarea', max: 2000 },
  vision: { type: 'textarea', max: 2000 },
};

export const SECTION_FIELDS: Record<string, FieldSpec> = {
  title: { type: 'text', max: 120 },
  body: { type: 'textarea', max: 8000 },
  image_url: { type: 'url' },
};

export const SEO_FIELDS: Record<string, FieldSpec> = {
  seo_title: { type: 'text', max: 70 },
  meta_description: { type: 'textarea', max: 200 },
  slug: { type: 'text', max: 80 },
  og_image_url: { type: 'url' },
  canonical_url: { type: 'url' },
  no_index: { type: 'boolean' },
};

export const SECTION_KEYS = [
  'quem_somos',
  'origem',
  'contexto',
  'problema',
  'publico',
  'papel',
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export function isSectionKey(value: unknown): value is SectionKey {
  return typeof value === 'string' && (SECTION_KEYS as readonly string[]).includes(value);
}

// Label dictionaries for UI display
export const AUDIENCE_LABELS: Record<string, string> = {
  citizens: 'Cidadãos',
  businesses: 'Empresas',
  organizers: 'Organizadores',
  partners: 'Parceiros',
  quality: 'Qualidade',
  accessibility: 'Acessibilidade',
  transparency: 'Transparência',
  community: 'Comunidade',
};

export const CONTACT_PURPOSE_LABELS: Record<string, string> = {
  institutional: 'Institucional',
  support: 'Suporte',
  commercial: 'Comercial',
  press: 'Imprensa',
};

export const SECTION_LABELS: Record<string, string> = {
  quem_somos: 'Quem Somos',
  origem: 'Origem',
  contexto: 'Contexto',
  problema: 'Problema',
  publico: 'Público-alvo',
  papel: 'Papel',
};

export interface EntityRow {
  id: number;
  position: number;
  isVisible: boolean;
  updatedAt?: string | null;
  [field: string]: unknown;
}

export interface InstitutionalDocument {
  profile: Record<string, string>;
  purpose: Record<string, string>;
  sections: Array<EntityRow & { sectionKey: string }>;
  seo: Record<string, string | boolean>;
  entities: Record<EntityKind, EntityRow[]>;
}

export interface InstitutionalSnapshot {
  version: 1;
  profile: Record<string, string>;
  purpose: Record<string, string>;
  sections: Array<Record<string, unknown>>;
  seo: Record<string, string | boolean>;
  entities: Record<EntityKind, EntityRow[]>;
}

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface ValidationOutcome {
  value: Record<string, string | boolean>;
  errors: Record<string, string>;
}

function clean(value: string): string {
  return value.replace(CONTROL_CHARACTERS, '').trim();
}

/** Valida e normaliza os campos declarados; campos extra são ignorados. */
export function validateFields(
  fields: Record<string, FieldSpec>,
  input: Record<string, unknown>,
): ValidationOutcome {
  const value: Record<string, string | boolean> = {};
  const errors: Record<string, string> = {};
  const currentYear = new Date().getFullYear();

  for (const [key, spec] of Object.entries(fields)) {
    const raw = input[key];
    if (spec.type === 'boolean') {
      value[key] = raw === true || raw === 'true';
      continue;
    }
    if (typeof raw === 'boolean') {
      value[key] = raw;
      continue;
    }
    if (raw !== undefined && raw !== null && typeof raw !== 'string' && typeof raw !== 'number') {
      errors[key] = 'Valor inválido.';
      continue;
    }
    const text = clean(String(raw ?? ''));
    if (!text) {
      if (spec.required) errors[key] = 'Campo obrigatório.';
      value[key] = '';
      continue;
    }
    if (spec.max && text.length > spec.max) {
      errors[key] = `Máximo de ${spec.max} caracteres.`;
      continue;
    }
    switch (spec.type) {
      case 'url': {
        try {
          const url = new URL(text);
          if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('protocol');
          if (text.length > 2048) throw new Error('length');
          value[key] = text;
        } catch {
          errors[key] = 'Use um endereço http:// ou https:// válido.';
        }
        break;
      }
      case 'email': {
        const emailCheck = normaliseAndValidateEmail(text);
        if (!emailCheck.ok) errors[key] = 'Email inválido.';
        else value[key] = emailCheck.email ?? text;
        break;
      }
      case 'color':
        if (!COLOR_PATTERN.test(text)) errors[key] = 'Use uma cor no formato #RRGGBB.';
        else value[key] = text;
        break;
      case 'date': {
        const parsed = new Date(`${text}T00:00:00Z`);
        if (!DATE_PATTERN.test(text) || Number.isNaN(parsed.getTime())) {
          errors[key] = 'Use uma data no formato AAAA-MM-DD.';
        } else {
          value[key] = text;
        }
        break;
      }
      case 'year': {
        const year = Number(text);
        if (!Number.isInteger(year) || year < 1800 || year > currentYear + 1) {
          errors[key] = `Indique um ano entre 1800 e ${currentYear + 1}.`;
        } else {
          value[key] = String(year);
        }
        break;
      }
      case 'enum':
        if (!spec.values || !spec.values.includes(text)) errors[key] = 'Opção inválida.';
        else value[key] = text;
        break;
      default:
        value[key] = text;
    }
  }

  return { value, errors };
}

export function describeValidationErrors(errors: Record<string, string>): string {
  return Object.values(errors)[0] || 'Conteúdo inválido.';
}

/** Constrói o documento publicado a partir do estado de trabalho. */
export function buildSnapshot(document: InstitutionalDocument): InstitutionalSnapshot {
  return {
    version: 1,
    profile: { ...document.profile },
    purpose: { ...document.purpose },
    sections: document.sections.map((section) => ({
      sectionKey: section.sectionKey,
      title: String(section.title ?? ''),
      body: String(section.body ?? ''),
      imageUrl: String(section.imageUrl ?? ''),
      isVisible: section.isVisible !== false,
      position: Number(section.position ?? 0),
    })),
    seo: { ...document.seo },
    entities: Object.fromEntries(
      ENTITY_KINDS.map((kind) => [
        kind,
        document.entities[kind].map((row) => ({
          ...row,
          isVisible: row.isVisible !== false,
        })),
      ]),
    ) as Record<EntityKind, EntityRow[]>,
  };
}

/** Documento devolvido publicamente: só itens visíveis e conteúdo preenchido. */
export function toPublicSnapshot(snapshot: InstitutionalSnapshot): InstitutionalSnapshot {
  const today = new Date().toISOString().slice(0, 10);
  // Só o conteúdo publicado chega ao site: documentos em rascunho/arquivo e
  // comunicações não publicadas (ou fora da janela de datas) ficam de fora.
  const statusOk = (kind: EntityKind, row: EntityRow): boolean => {
    if (kind === 'documents') {
      const status = String(row.status ?? '').trim();
      return status === '' || status === 'published';
    }
    if (kind === 'communications') {
      if (String(row.status ?? '').trim() !== 'published') return false;
      const publishAt = String(row.publish_at ?? '').trim();
      if (publishAt && publishAt > today) return false;
      const expiresAt = String(row.expires_at ?? '').trim();
      if (expiresAt && expiresAt < today) return false;
      return true;
    }
    return true;
  };
  const visible = (rows: EntityRow[], kind?: EntityKind) =>
    rows.filter((row) => row.isVisible !== false && (!kind || statusOk(kind, row)));
  return {
    version: 1,
    profile: snapshot.profile,
    purpose: snapshot.purpose,
    sections: snapshot.sections.filter((section) => {
      if (section.isVisible === false) return false;
      return String(section.body ?? '').trim().length > 0 || String(section.title ?? '').trim().length > 0;
    }),
    seo: snapshot.seo,
    entities: Object.fromEntries(
      ENTITY_KINDS.map((kind) => [kind, visible(snapshot.entities[kind] ?? [], kind)]),
    ) as Record<EntityKind, EntityRow[]>,
  };
}

export interface MissingField {
  label: string;
  detail: string;
}

/** Campos que impedem uma publicação responsável. */
export function findMissingContent(document: InstitutionalDocument): MissingField[] {
  const missing: MissingField[] = [];
  const profile = document.profile;

  if (!String(profile.official_name ?? '').trim()) {
    missing.push({ label: 'Identidade institucional', detail: 'Nome oficial da plataforma' });
  }
  if (!String(profile.short_description ?? '').trim()) {
    missing.push({ label: 'Identidade institucional', detail: 'Descrição institucional curta' });
  }

  const about = document.sections.find((section) => section.sectionKey === 'quem_somos');
  if (!about || !String(about.body ?? '').trim()) {
    missing.push({ label: 'Quem Somos', detail: 'Texto de apresentação da plataforma' });
  }

  const hasContact = document.entities.contacts.some(
    (contact) => 
      contact.isVisible !== false && 
      (String(contact.email ?? '').trim() !== '' || String(contact.phone ?? '').trim() !== ''),
  );
  if (!hasContact) {
    missing.push({ label: 'Contactos Institucionais', detail: 'Pelo menos um contacto visível com email ou telefone' });
  }

  return missing;
}

/** Compara o estado de trabalho com a última publicação. */
export function isDocumentDirty(
  snapshot: InstitutionalSnapshot,
  published: InstitutionalSnapshot | null,
): boolean {
  if (!published) return true;
  return JSON.stringify(snapshot) !== JSON.stringify(published);
}

// Entity panel UI definitions
export const ENTITY_UI = {
  values: {
    singular: 'valor',
    fieldLabels: {
      name: 'Nome',
      description: 'Descrição',
      icon: 'Ícone',
    },
    uploads: {
      name: 'image',
    },
  },
  timeline: {
    singular: 'etapa',
    fieldLabels: {
      title: 'Título',
      period_label: 'Período',
      description: 'Descrição',
      image_url: 'Imagem',
      category: 'Categoria',
    },
    uploads: {
      title: 'image',
    },
  },
  objectives: {
    singular: 'objetivo',
    fieldLabels: {
      audience: 'Audience',
      title: 'Título',
      description: 'Descrição',
    },
  },
  team: {
    singular: 'membro',
    fieldLabels: {
      name: 'Nome',
      role_title: 'Cargo',
      bio: 'Biografia',
      photo_url: 'Foto',
      department: 'Departamento',
    },
    uploads: {
      photo_url: 'image',
    },
  },
  departments: {
    singular: 'área',
    fieldLabels: {
      name: 'Nome',
      description: 'Descrição',
      image_url: 'Imagem',
      responsibility: 'Responsabilidade',
    },
  },
  partners: {
    singular: 'parceiro',
    fieldLabels: {
      name: 'Nome',
      logo_url: 'Logo',
      description: 'Descrição',
      website_url: 'Website',
      category: 'Categoria',
    },
  },
  contacts: {
    singular: 'contacto',
    fieldLabels: {
      purpose: 'Finalidade',
      label: 'Rótulo',
      email: 'Email',
      phone: 'Telefone',
      whatsapp: 'WhatsApp',
      address: 'Endereço',
      city: 'Cidade',
      hours: 'Horário',
    },
  },
  social_links: {
    singular: 'canal',
    fieldLabels: {
      network: 'Rede',
      label: 'Rótulo',
      url: 'URL',
      icon: 'Ícone',
    },
  },
  gallery: {
    singular: 'imagem',
    fieldLabels: {
      title: 'Título',
      description: 'Descrição',
      file_url: 'URL da imagem',
      alt_text: 'Texto alternativo',
      category: 'Categoria',
    },
  },
  faq: {
    singular: 'pergunta',
    fieldLabels: {
      question: 'Pergunta',
      answer: 'Resposta',
      category: 'Categoria',
    },
  },
  documents: {
    singular: 'documento',
    fieldLabels: {
      name: 'Título',
      slug: 'Slug',
      description: 'Descrição',
      content: 'Conteúdo',
      version: 'Versão',
      status: 'Estado',
      category: 'Tipo',
      file_url: 'Ficheiro (PDF)',
      document_date: 'Data do documento',
      published_at: 'Data de publicação',
    },
    uploads: {
      file_url: 'document',
    },
  },
  services: {
    singular: 'serviço',
    fieldLabels: {
      name: 'Nome',
      description: 'Descrição curta',
      detailed_description: 'Descrição detalhada',
      icon: 'Ícone',
      image_url: 'Imagem',
      category: 'Categoria',
      link_url: 'Link',
    },
    uploads: {
      image_url: 'image',
    },
  },
  communications: {
    singular: 'conteúdo',
    fieldLabels: {
      title: 'Título',
      slug: 'Slug',
      type: 'Tipo',
      body: 'Conteúdo',
      image_url: 'Imagem',
      audience: 'Público',
      status: 'Estado',
      publish_at: 'Publicar a partir de',
      expires_at: 'Expira a',
      author: 'Autor',
    },
    uploads: {
      image_url: 'image',
    },
  },
  assets: {
    singular: 'ativo',
    fieldLabels: {
      asset_kind: 'Tipo de ativo',
      label: 'Nome',
      url: 'Ficheiro',
      mime_type: 'Formato',
      size_bytes: 'Tamanho (bytes)',
    },
    uploads: {
      url: 'image',
    },
  },
} as const;

