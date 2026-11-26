/** Tipos partilhados pelo lote africano do catálogo (`afr-*`). */

export type ReviewSeed = {
  author: string;
  score: 'gostei' | 'gostei_muito' | 'muito_bom';
  comment: string;
  daysAgo: number;
};

export type BusinessSeed = {
  n: number;
  slug: string;
  name: string;
  categoryId: string;
  subcategoryId: string;
  subcategoryName: string;
  groupGroupId:
    | 'restauracao'
    | 'hotelaria_saude_educacao'
    | 'corporativo_financeiro'
    | 'ongs_artesãos'
    | 'servicos_profissionais';
  /** Tema visual: escolhe o conjunto de fotos em public/uploads/africa/<tema>. */
  theme: 'comida' | 'praia' | 'cidade' | 'cultura' | 'mercado' | 'natureza' | 'pessoas' | 'trabalho';
  neighborhood: string;
  address: string;
  description: string;
  tagline: string;
  openingHours: string;
  phone: string;
  whatsapp: string;
  publicEmail: string;
  website: string;
  priceRange: '$' | '$$' | '$$$';
  tier: 'professional' | 'premium' | 'enterprise';
  features: string[];
  products: Array<{ name: string; priceXOF: number }>;
  languages: Array<'pt' | 'fr' | 'en'>;
  social: { facebook?: string; instagram?: string };
  ratingLabel: string;
  reviewsCount: number;
  reviews: ReviewSeed[];
  post: { title: string; content: string; daysAgo: number; likes: number };
  promotion: {
    title: string;
    description: string;
    badge: string;
    code: string;
    validDays: number;
    clicks: number;
  };
  brand: { from: string; to: string; initials: string };
};

export type EventSeed = {
  id: string;
  /** Número da empresa organizadora (1..50). */
  businessN: number;
  title: string;
  description: string;
  category: string;
  daysFromNow: number;
  hour: number;
  minute: number;
  durationHours: number;
  capacity: number;
  tickets: Array<{ name: string; priceXOF: number; quantity: number }>;
};
