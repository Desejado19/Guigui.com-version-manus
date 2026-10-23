import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve('src');
const specs = new Set();

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(entry.name)) {
      const text = readFileSync(p, 'utf8');
      const re = /(?:from\s+|import\s+|import\(\s*)['"]([^'"]+)['"]/g;
      let m;
      while ((m = re.exec(text))) {
        const spec = m[1];
        if (!spec.startsWith('.') && !spec.startsWith('/')) specs.add(spec);
      }
    }
  }
}

walk(root);
console.log([...specs].sort().join('\n'));
