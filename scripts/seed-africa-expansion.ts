/**
 * Lote africano do Guigui.com — tema Guiné-Bissau.
 *
 * Cria 50 empresas completas (capa, galeria, logótipo, contactos, horário,
 * produtos, avaliações, uma publicação e um desconto activos) e 50 eventos
 * publicados com bilheteiras. As fotos são imagens reais da Guiné-Bissau
 * recolhidas do Wikimedia Commons em public/uploads/africa/<tema>/ e copiadas
 * para public/uploads/africa/<slug>/.
 *
 * Uso:
 *   npx tsx scripts/seed-africa-expansion.ts          # cria/actualiza
 *   npx tsx scripts/seed-africa-expansion.ts --clean  # remove só o lote afr-*
 *
 * Idempotente: ids `afr-co-*`, `afr-usr-*`, `afr-ev-*`, `afr-post-*`,
 * `afr-promo-*` e upserts. Não toca em empresas showcase-* nem biz-*.
 * Contas criadas: empresa.africaNN@guigui.test / Guigui2026!
 */
import 'dotenv/config?override=true';
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { hashPassword } from '../server/modules/identity-access';
import { BUSINESSES_1 } from './africa/businesses-1';
import { BUSINESSES_2 } from './africa/businesses-2';
import { BUSINESSES_3 } from './africa/businesses-3';
import { BUSINESSES_4 } from './africa/businesses-4';
import { BUSINESSES_5 } from './africa/businesses-5';
import { EVENTS_1 } from './africa/events-1';
import { EVENTS_2 } from './africa/events-2';
import type { BusinessSeed, EventSeed } from './africa/types';

const SEED_PASSWORD = 'Guigui2026!';
const SEED_DOMAIN = 'guigui.test';
const AFRICA_ROOT = path.resolve(process.cwd(), 'public', 'uploads', 'africa');

const BUSINESSES: BusinessSeed[] = [
  ...BUSINESSES_1,
  ...BUSINESSES_2,
  ...BUSINESSES_3,
  ...BUSINESSES_4,
  ...BUSINESSES_5,
];
const EVENTS: EventSeed[] = [...EVENTS_1, ...EVENTS_2];

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function isoDaysAgo(days: number, hour = 10): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function isoDaysFromNow(days: number, hour = 19, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function logoSvg(initials: string, from: string, to: string): string {
  const fontSize = initials.length > 2 ? 92 : 118;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320" role="img">
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="320" height="320" rx="72" fill="url(#brand)"/>
  <circle cx="160" cy="160" r="108" fill="none" stroke="#ffffff" stroke-opacity="0.24" stroke-width="2"/>
  <text x="160" y="168" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="700" fill="#ffffff" letter-spacing="4">${initials}</text>
</svg>
`;
}

let photoCache: Map<string, string[]> | null = null;

/** Fotos disponíveis por tema (ficheiros jpg reais em public/uploads/africa/<tema>). */
function photosByTheme(): Map<string, string[]> {
  if (photoCache) return photoCache;
  const map = new Map<string, string[]>();
  if (!existsSync(AFRICA_ROOT)) return map;
  for (const entry of readdirSync(AFRICA_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(AFRICA_ROOT, entry.name);
    const files = readdirSync(dir)
      .filter((file) => /\.(jpe?g|png)$/i.test(file))
      .sort()
      .map((file) => path.join(dir, file));
    if (files.length > 0) map.set(entry.name, files);
  }
  photoCache = map;
  return map;
}

function writeAssets(business: BusinessSeed): void {
  const dir = path.join(AFRICA_ROOT, business.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'logo.svg'), logoSvg(business.brand.initials, business.brand.from, business.brand.to), 'utf8');

  const pool = photosByTheme().get(business.theme) ?? [];
  if (pool.length === 0) {
    throw new Error(`Sem fotos para o tema "${business.theme}" (empresa ${business.n}).`);
  }
  const start = (business.n * 3) % pool.length;
  ['cover.jpg', 'gallery-1.jpg', 'gallery-2.jpg'].forEach((name, index) => {
    const source = pool[(start + index) % pool.length];
    copyFileSync(source, path.join(dir, name));
  });
}

function buildBusinessData(business: BusinessSeed, ownerEmail: string): Record<string, unknown> {
  const id = `afr-co-${pad2(business.n)}`;
  const assetBase = `/uploads/africa/${business.slug}`;
  const logo = `${assetBase}/logo.svg`;
  const coverImage = `${assetBase}/cover.jpg`;
  const gallery = [coverImage, `${assetBase}/gallery-1.jpg`, `${assetBase}/gallery-2.jpg`];

  const createdAt = isoDaysAgo(business.post.daysAgo, 9);
  const post = {
    id: `afr-post-${pad2(business.n)}-1`,
    businessId: id,
    businessName: business.name,
    businessLogo: logo,
    title: business.post.title,
    content: business.post.content,
    imageUrl: gallery[1],
    mediaType: 'image',
    status: 'approved',
    createdAt,
    publishedAt: createdAt,
    likesCount: business.post.likes,
    sharesCount: Math.round(business.post.likes / 4),
    comments: [],
    reactions: {
      like: business.post.likes,
      love: Math.round(business.post.likes / 3),
      wow: 2,
      haha: 0,
      sad: 0,
      angry: 0,
    },
    isPlanSubscriberPost: business.tier === 'premium' || business.tier === 'enterprise',
    planBadge:
      business.tier === 'enterprise' ? 'Plano Empresa' : business.tier === 'premium' ? 'Plano Premium' : 'Plano Profissional',
  };

  const promotion = {
    id: `afr-promo-${pad2(business.n)}`,
    businessId: id,
    businessName: business.name,
    title: business.promotion.title,
    description: business.promotion.description,
    discountBadge: business.promotion.badge,
    code: business.promotion.code,
    validUntil: isoDaysFromNow(business.promotion.validDays, 23, 59),
    startsAt: isoDaysAgo(7, 9),
    activatedAt: isoDaysAgo(7, 9),
    imageUrl: coverImage,
    mediaType: 'image',
    categoryName: business.subcategoryName,
    neighborhood: business.neighborhood,
    isActive: true,
    status: 'active',
    clicksCount: business.promotion.clicks,
  };

  const reviews = business.reviews.map((review, index) => ({
    id: `afr-review-${pad2(business.n)}-${index + 1}`,
    businessId: id,
    authorName: review.author,
    authorPhone: `+245 95• •• •${pad2(11 + index)}`,
    qualitativeScore: review.score,
    comment: review.comment,
    createdAt: isoDaysAgo(review.daysAgo, 15),
    verifiedSms: true,
    status: 'approved',
  }));

  return {
    id,
    name: business.name,
    slug: business.slug,
    logo,
    coverImage,
    gallery,
    description: business.description,
    tagline: business.tagline,
    categoryId: business.categoryId,
    subcategoryId: business.subcategoryId,
    groupGroupId: business.groupGroupId,
    tier: business.tier,
    neighborhood: business.neighborhood,
    address: business.address,
    phone: business.phone,
    whatsapp: business.whatsapp,
    email: ownerEmail,
    publicEmail: business.publicEmail,
    website: business.website,
    openingHours: business.openingHours,
    isOpenNow: true,
    priceRange: business.priceRange,
    status: 'active',
    verified: true,
    featured: false,
    homepageFeaturedOrder: null,
    ratingLabel: business.ratingLabel,
    reviewsCount: business.reviewsCount,
    reviews,
    posts: [post],
    promotions: [promotion],
    features: business.features,
    products: business.products.map((product, index) => ({
      id: `afr-product-${pad2(business.n)}-${index + 1}`,
      name: product.name,
      category: business.subcategoryName,
      priceXOF: product.priceXOF,
      isAvailable: true,
    })),
    socialLinks: business.social,
    serviceLanguages: business.languages,
    ownerName: `Gestão ${business.name}`,
    ownerEmail,
    createdAt: isoDaysAgo(150 - business.n, 9),
    metrics: {
      views: 640 + business.n * 121,
      whatsappClicks: 54 + business.n * 9,
      phoneClicks: 24 + business.n * 5,
      directionsClicks: 15 + business.n * 3,
      websiteClicks: 9 + business.n * 2,
    },
    subscriptionRenewDate: isoDaysFromNow(28, 0, 0).slice(0, 10),
    subscriptionPeriod: 'monthly',
    subscriptionStatus: 'active',
    subscriptionStartedAt: isoDaysAgo(120 - business.n, 9),
    postsQuotaRemaining: business.tier === 'professional' ? 6 : 10,
  };
}

async function upsertBusiness(client: PoolClient, business: BusinessSeed, passwordHash: string): Promise<void> {
  const id = `afr-co-${pad2(business.n)}`;
  const userId = `afr-usr-${pad2(business.n)}`;
  const email = `empresa.africa${pad2(business.n)}@${SEED_DOMAIN}`;
  const data = buildBusinessData(business, email);

  const existingUser = await client.query('SELECT id FROM users WHERE LOWER(email)=LOWER($1)', [email]);
  if (existingUser.rowCount === 0) {
    await client.query(
      `INSERT INTO users (id, name, email, phone, neighborhood, role, account_status, password_hash, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'business','active',$6,NOW(),NOW())`,
      [userId, `Gestão ${business.name}`, email, business.phone, business.neighborhood, passwordHash],
    );
  }

  await client.query(
    `INSERT INTO companies (id, owner_user_id, name, status, category_id, data, created_at, updated_at)
     VALUES ($1,$2,$3,'active',$4,$5::jsonb,NOW(),NOW())
     ON CONFLICT (id) DO UPDATE
       SET owner_user_id=EXCLUDED.owner_user_id,
           name=EXCLUDED.name,
           status=EXCLUDED.status,
           category_id=EXCLUDED.category_id,
           data=EXCLUDED.data,
           updated_at=NOW()`,
    [id, userId, business.name, business.categoryId, JSON.stringify(data)],
  );

  await client.query(
    `INSERT INTO company_members (company_id, user_id, member_role, accepted_at)
     VALUES ($1,$2,'manager',NOW()) ON CONFLICT (company_id, user_id) DO NOTHING`,
    [id, userId],
  );
}

async function upsertEvent(client: PoolClient, business: BusinessSeed, event: EventSeed): Promise<void> {
  const companyId = `afr-co-${pad2(business.n)}`;
  const assetBase = `/uploads/africa/${business.slug}`;
  const startsAt = isoDaysFromNow(event.daysFromNow, event.hour, event.minute);
  const endsAt = isoDaysFromNow(event.daysFromNow, event.hour + event.durationHours, event.minute);
  const ticketTypes = event.tickets.map((type, index) => ({
    id: `${event.id}-tt-${index + 1}`,
    name: type.name,
    priceXOF: type.priceXOF,
    quantity: type.quantity,
  }));

  const data = {
    id: event.id,
    businessId: companyId,
    title: event.title,
    status: 'published',
    organizerName: business.name,
    organizerLogo: `${assetBase}/logo.svg`,
    category: event.category,
    date: startsAt.slice(0, 10),
    time: `${pad2(event.hour)}:${pad2(event.minute)}`,
    location: business.address,
    neighborhood: business.neighborhood,
    address: business.address,
    coverImage: `${assetBase}/cover.jpg`,
    gallery: [`${assetBase}/cover.jpg`, `${assetBase}/gallery-1.jpg`],
    description: event.description,
    capacity: event.capacity,
    rules: 'Bilhete válido para uma entrada. Apresentar o código QR à entrada do recinto.',
    scannerDoorCode: `AFR${pad2(business.n)}26`,
    ticketTypes: ticketTypes.map((type) => ({
      id: type.id,
      name: type.name,
      priceXOF: type.priceXOF,
      availableQuantity: type.quantity,
      soldQuantity: 0,
      salesOpen: true,
    })),
  };

  await client.query(
    `INSERT INTO events (id, company_id, title, status, starts_at, ends_at, data, created_at, updated_at)
     VALUES ($1,$2,$3,'published',$4,$5,$6::jsonb,NOW(),NOW())
     ON CONFLICT (id) DO UPDATE
       SET company_id=EXCLUDED.company_id,
           title=EXCLUDED.title,
           status=EXCLUDED.status,
           starts_at=EXCLUDED.starts_at,
           ends_at=EXCLUDED.ends_at,
           data=EXCLUDED.data,
           updated_at=NOW()`,
    [event.id, companyId, event.title, startsAt, endsAt, JSON.stringify(data)],
  );

  for (const type of ticketTypes) {
    await client.query(
      `INSERT INTO ticket_types (id, event_id, name, price_xof, quantity)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (event_id, name) DO UPDATE
         SET price_xof=EXCLUDED.price_xof, quantity=EXCLUDED.quantity`,
      [type.id, event.id, type.name, type.priceXOF, type.quantity],
    );
  }
}

async function clean(client: PoolClient): Promise<void> {
  await client.query("DELETE FROM ticket_types WHERE event_id LIKE 'afr-ev-%'");
  const events = await client.query("DELETE FROM events WHERE id LIKE 'afr-ev-%'");
  const members = await client.query("DELETE FROM company_members WHERE company_id LIKE 'afr-co-%'");
  const companies = await client.query("DELETE FROM companies WHERE id LIKE 'afr-co-%'");
  const users = await client.query("DELETE FROM users WHERE email LIKE 'empresa.africa%@guigui.test'");
  console.log(
    `[africa-clean] ${events.rowCount} eventos, ${members.rowCount} vínculos, ${companies.rowCount} empresas, ${users.rowCount} utilizadores removidos.`,
  );
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('DATABASE_URL obrigatória.');

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    const meta = await client.query('SELECT current_database() AS db');
    const db = String(meta.rows[0].db);
    if (!['guigui', 'guigui_test', 'guigui_demo'].includes(db)) {
      throw new Error(`Base "${db}" não parece ser de desenvolvimento; abortar sem alterações.`);
    }
    console.log(`[africa] base=${db} empresas=${BUSINESSES.length} eventos=${EVENTS.length}`);

    if (process.argv.includes('--clean')) {
      await clean(client);
      return;
    }

    const categories = await client.query('SELECT id FROM categories WHERE id = ANY($1)', [
      [...new Set(BUSINESSES.map((business) => business.categoryId))],
    ]);
    const knownCategories = new Set(categories.rows.map((row) => String(row.id)));
    const missing = BUSINESSES.filter((business) => !knownCategories.has(business.categoryId));
    if (missing.length > 0) {
      throw new Error(`Categorias em falta: ${missing.map((business) => business.categoryId).join(', ')}.`);
    }

    const byNumber = new Map(BUSINESSES.map((business) => [business.n, business]));
    const orphanEvents = EVENTS.filter((event) => !byNumber.has(event.businessN));
    if (orphanEvents.length > 0) {
      throw new Error(`Eventos sem empresa: ${orphanEvents.map((event) => event.id).join(', ')}.`);
    }

    const passwordHash = hashPassword(SEED_PASSWORD);
    await client.query('BEGIN');
    for (const business of BUSINESSES) {
      writeAssets(business);
      await upsertBusiness(client, business, passwordHash);
    }
    for (const event of EVENTS) {
      await upsertEvent(client, byNumber.get(event.businessN) as BusinessSeed, event);
    }
    await client.query('COMMIT');

    const summary = await client.query(
      `SELECT COUNT(*)::int AS empresas,
              SUM(jsonb_array_length(COALESCE(data->'posts','[]'::jsonb)))::int AS posts,
              SUM(jsonb_array_length(COALESCE(data->'promotions','[]'::jsonb)))::int AS promocoes,
              SUM(jsonb_array_length(COALESCE(data->'reviews','[]'::jsonb)))::int AS avaliacoes
         FROM companies WHERE id LIKE 'afr-co-%'`,
    );
    const events = await client.query(
      `SELECT COUNT(*)::int AS total FROM events WHERE id LIKE 'afr-ev-%' AND status='published'`,
    );
    const tickets = await client.query(
      `SELECT COUNT(*)::int AS total FROM ticket_types WHERE event_id LIKE 'afr-ev-%'`,
    );
    const row = summary.rows[0];
    console.log(
      `[africa] empresas=${row.empresas} publicações=${row.posts} descontos=${row.promocoes} avaliações=${row.avaliacoes} eventos=${events.rows[0].total} bilheteiras=${tickets.rows[0].total}`,
    );
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[africa] FALHOU:', error instanceof Error ? error.message : error);
  process.exit(1);
});
