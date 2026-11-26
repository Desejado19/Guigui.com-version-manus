/**
 * Sincroniza a chave guigui_businesses do app_state (PostgreSQL) com a tabela
 * companies: a lista que o frontend carrega por polling passa a reflectir a BD
 * (empresas criadas, estados actuais e sem o lixo já removido).
 * Uso: npx tsx scripts/sync-appstate-businesses.ts
 */
import 'dotenv/config?override=true';
import { listPostgresBusinesses, setAppState } from '../server/postgresBusinessService';

const DEFAULT_METRICS = { views: 0, phoneClicks: 0, websiteClicks: 0, whatsappClicks: 0, directionsClicks: 0 };

async function main(): Promise<void> {
  const rows = await listPostgresBusinesses();
  const businesses = rows.map((row: Record<string, any>) => ({
    // Defaults para todos os campos obrigatórios do tipo Business; os campos
    // existentes no registo da BD (row) sobrepõem-se aos defaults.
    slug: String(row.name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-'),
    logo: '',
    coverImage: '',
    description: '',
    subcategoryId: '',
    groupGroupId: 'corporativo_financeiro',
    tier: 'basic',
    neighborhood: 'Bissau',
    address: 'Bissau',
    phone: '',
    whatsapp: '',
    openingHours: '',
    isOpenNow: false,
    priceRange: '$$',
    verified: false,
    featured: false,
    ratingLabel: '',
    reviewsCount: 0,
    postsQuotaRemaining: 3,
    subscriptionRenewDate: row.createdAt || new Date().toISOString(),
    ...row,
    id: row.id,
    name: row.name,
    status: row.status || 'active',
    categoryId: row.categoryId || '',
    metrics: row.metrics && typeof row.metrics === 'object' ? row.metrics : { ...DEFAULT_METRICS },
    posts: Array.isArray(row.posts) ? row.posts : [],
    reviews: Array.isArray(row.reviews) ? row.reviews : [],
    promotions: Array.isArray(row.promotions) ? row.promotions : [],
    gallery: Array.isArray(row.gallery) ? row.gallery : [],
  }));
  await setAppState('guigui_businesses', businesses);
  const active = businesses.filter((business: Record<string, any>) => business.status === 'active').length;
  console.log(`sync-appstate: guigui_businesses actualizado com ${businesses.length} empresas (active=${active}).`);
}

main().catch((error) => {
  console.error('sync-appstate falhou:', error);
  process.exit(1);
});