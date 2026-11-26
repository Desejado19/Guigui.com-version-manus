/**
 * Recolhe fotos reais da Guiné-Bissau a partir do Wikimedia Commons.
 *
 * Grava miniaturas de 1200px em public/uploads/africa/<tema>/ e um
 * manifest com título, autor, licença e página de origem, para que o seed do
 * catálogo africano possa usar imagens autênticas em vez de placeholders.
 *
 * Uso:
 *   npx tsx scripts/fetch-africa-photos.ts            # só descarrega o que falta
 *   npx tsx scripts/fetch-africa-photos.ts --force    # re-descarrega tudo
 */
import 'dotenv/config?override=true';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'public', 'uploads', 'africa');
const API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'GuiguiCatalogBot/1.0 (local dev catalogue seed; contact: dev@guigui.test)';
const PHOTOS_PER_THEME = 28;
const THUMB_WIDTH = 1200;

const THEMES: Record<string, string[]> = {
  comida: ['Guinea-Bissau cuisine', 'Bissau food market', 'Guinea-Bissau rice dish', 'Bissau fish'],
  praia: ['Bijagos beach', 'Guinea-Bissau beach', 'Orango island', 'Guinea-Bissau coast'],
  cidade: ['Bissau street', 'Bissau building', 'Bissau', 'Guinea-Bissau town'],
  cultura: ['Bissau carnival', 'Guinea-Bissau dance', 'Guinea-Bissau music', 'Guinea-Bissau culture'],
  mercado: ['Bissau market', 'Guinea-Bissau market', 'Bissau vendors', 'Guinea-Bissau trade'],
  natureza: ['Guinea-Bissau landscape', 'Bijagos archipelago', 'Guinea-Bissau nature', 'Guinea-Bissau river'],
  pessoas: ['Guinea-Bissau people', 'Bissau children', 'Guinea-Bissau portrait', 'Bissau people'],
  trabalho: ['Guinea-Bissau agriculture', 'Guinea-Bissau cashew', 'Guinea-Bissau fishing', 'Bissau harbour'],
};

const EXCLUDED_TITLE = /(map|logo|coat of arms|flag|diagram|chart|seal|banknote|stamp|emblem|banner|screenshot|graph|plan\b)/i;

type Candidate = {
  title: string;
  thumbUrl: string;
  pageUrl: string;
  artist: string;
  license: string;
};

type ImagePage = {
  title: string;
  imageinfo?: Array<{
    mime?: string;
    width?: number;
    thumburl?: string;
    descriptionurl?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
};

async function searchTheme(query: string): Promise<Candidate[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: '6',
    gsrlimit: '25',
    prop: 'imageinfo',
    iiprop: 'url|mime|size|extmetadata',
    iiurlwidth: String(THUMB_WIDTH),
  });
  const response = await fetch(`${API}?${params}`, {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
  });
  if (!response.ok) {
    console.warn(`[africa-photos] ${query}: HTTP ${response.status}`);
    return [];
  }
  const payload = (await response.json()) as { query?: { pages?: Record<string, ImagePage> } };
  const pages = Object.values(payload.query?.pages ?? {});
  const result: Candidate[] = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info?.thumburl || !info.thumburl.startsWith('https://')) continue;
    if (info.mime !== 'image/jpeg' && info.mime !== 'image/png') continue;
    if ((info.width ?? 0) < 1000) continue;
    if (EXCLUDED_TITLE.test(page.title)) continue;
    const meta = info.extmetadata ?? {};
    const stripHtml = (value?: string) => (value ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    result.push({
      title: page.title.replace(/^File:/, ''),
      thumbUrl: info.thumburl.split('?')[0],
      pageUrl: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
      artist: stripHtml(meta.Artist?.value).slice(0, 160) || 'Wikimedia Commons',
      license: stripHtml(meta.LicenseShortName?.value).slice(0, 80) || 'Ver página de origem',
    });
  }
  return result;
}

function fileExtension(url: string): string {
  const clean = url.split('?')[0];
  const ext = path.extname(clean).toLowerCase();
  return ext === '.png' ? '.png' : '.jpg';
}

async function download(url: string, target: string): Promise<number> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 20_000) throw new Error(`ficheiro demasiado pequeno (${buffer.length} bytes)`);
  writeFileSync(target, buffer);
  return buffer.length;
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const manifestPath = path.join(ROOT, 'manifest.json');
  const manifest: Record<string, Array<{ file: string; title: string; artist: string; license: string; sourceUrl: string }>> =
    existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};

  let totalSaved = 0;
  for (const [theme, queries] of Object.entries(THEMES)) {
    const dir = path.join(ROOT, theme);
    mkdirSync(dir, { recursive: true });
    const entries = manifest[theme] ?? [];
    const knownTitles = new Set(entries.map((entry) => entry.title));
    const candidates: Candidate[] = [];
    for (const query of queries) {
      const found = await searchTheme(query);
      for (const candidate of found) {
        if (knownTitles.has(candidate.title)) continue;
        knownTitles.add(candidate.title);
        candidates.push(candidate);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    let saved = entries.length;
    for (const candidate of candidates) {
      if (saved >= PHOTOS_PER_THEME) break;
      const ext = fileExtension(candidate.thumbUrl);
      const fileName = `${theme}-${String(saved + 1).padStart(2, '0')}${ext}`;
      const target = path.join(dir, fileName);
      if (existsSync(target) && !force) {
        saved += 1;
        continue;
      }
      try {
        await download(candidate.thumbUrl, target);
        entries.push({
          file: fileName,
          title: candidate.title,
          artist: candidate.artist,
          license: candidate.license,
          sourceUrl: candidate.pageUrl,
        });
        saved += 1;
        totalSaved += 1;
        console.log(`[africa-photos] ${theme}/${fileName} ← ${candidate.title}`);
        await new Promise((resolve) => setTimeout(resolve, 120));
      } catch (error) {
        console.warn(`[africa-photos] falhou ${candidate.title}: ${error instanceof Error ? error.message : error}`);
      }
    }
    manifest[theme] = entries;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`[africa-photos] ${theme}: ${entries.length} fotos`);
  }
  console.log(`[africa-photos] concluído — ${totalSaved} ficheiros novos em public/uploads/africa`);
}

main().catch((error) => {
  console.error('[africa-photos] erro fatal:', error);
  process.exit(1);
});
