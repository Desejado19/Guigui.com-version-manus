import fs from 'fs';
import path from 'path';

const dist = path.resolve(process.cwd(), 'dist');
const publicDir = path.resolve(process.cwd(), 'public');

if (!fs.existsSync(dist)) {
  throw new Error('dist/ missing — run vite build first');
}

fs.mkdirSync(publicDir, { recursive: true });

function copyRecursive(from, to) {
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from)) {
      if (entry === 'server.mjs' || entry === 'server.mjs.map') continue;
      copyRecursive(path.join(from, entry), path.join(to, entry));
    }
    return;
  }
  fs.copyFileSync(from, to);
}

copyRecursive(dist, publicDir);
console.log('[vercel] copied dist/ into public/ for CDN static files');
