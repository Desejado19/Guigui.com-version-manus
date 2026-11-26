import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.cwd(), 'dist');
let failed = false;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.map')) {
      console.error(`[check-no-dev-exposure] sourcemap encontrado: ${full}`);
      failed = true;
    }
  }
}

const DEV_MARKERS = ['/@vite/client', '/@vite/', '/@fs/', '"/src/'];

function scanForDevMarkers(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanForDevMarkers(full);
      continue;
    }
    // O bundle do servidor contém, por desenho, as regras que bloqueiam estes
    // caminhos; só o frontend publicado é que não os pode referenciar.
    if (dir === dist && entry.name.endsWith('.mjs')) continue;
    if (!/\.(html|js|css)$/.test(entry.name)) continue;
    const text = fs.readFileSync(full, 'utf8');
    for (const marker of DEV_MARKERS) {
      if (text.includes(marker)) {
        console.error(`[check-no-dev-exposure] marcador de desenvolvimento "${marker}" em ${full}`);
        failed = true;
      }
    }
  }
}

if (fs.existsSync(dist)) {
  walk(dist);
  scanForDevMarkers(dist);
}

// Verifica se /server.ts não está a ser servido como ficheiro estático.
const serverTs = path.join(process.cwd(), 'dist', 'server.ts');
if (fs.existsSync(serverTs)) {
  console.error('[check-no-dev-exposure] server.ts encontrado em dist/');
  failed = true;
}

if (failed) {
  process.exit(1);
}
console.log('[check-no-dev-exposure] OK: sem sourcemaps nem fontes em dist/.');
