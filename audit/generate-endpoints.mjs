import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const collect = (file, prefix = '') => {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const regex = /(?:app|router)\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g;
  const result = [];
  let match;
  while ((match = regex.exec(source)) !== null) {
    const method = match[1].toUpperCase();
    let routePath = match[2];
    if (prefix && routePath.startsWith('/')) routePath = prefix + (routePath === '/' ? '' : routePath);
    if (!routePath.startsWith('/')) routePath = prefix + '/' + routePath;
    result.push({ method, path: routePath, source: file });
  }
  return result;
};

const endpoints = [
  ...collect('server.ts'),
  ...collect('server/categoryRoutes.ts', '/api/categories'),
  ...collect('server/storyRoutes.ts', '/api'),
  ...collect('server/institutional/routes.ts'),
  ...collect('server/googleOAuthRoutes.ts', '/api/auth/google'),
];

// Normaliza parâmetros para valores de teste inócuos.
const normalized = endpoints.map((entry) => ({
  ...entry,
  path: entry.path.replace(/:kind/g, 'about').replace(/:id/g, '1').replace(/:key/g, 'mission').replace(/:token/g, 'audit-token').replace(/:slug/g, 'politicas'),
}));

fs.mkdirSync('audit-evidence', { recursive: true });
fs.mkdirSync(path.join(root, 'audit-evidence'), { recursive: true });
fs.writeFileSync(path.join(root, 'audit-evidence', 'api-endpoints.json'), JSON.stringify(normalized, null, 2), 'utf8');
console.log(`endpoints: ${normalized.length}`);