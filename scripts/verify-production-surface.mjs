#!/usr/bin/env node
/**
 * Verificação de deploy: confirma que um servidor público (build de produção)
 * não expõe fontes, sourcemaps, endpoints do Vite/HMR nem detalhes internos
 * de saúde. Uso: BASE_URL=https://exemplo.com node scripts/verify-production-surface.mjs
 */
const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const forbiddenPaths = ['/server.ts', '/src/main.tsx', '/@vite/client', '/@fs/etc/passwd', '/assets/inexistente.js.map'];
const failures = [];

for (const path of forbiddenPaths) {
  try {
    const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' });
    if (response.status !== 404) {
      const type = response.headers.get('content-type') || 'desconhecido';
      failures.push(`${path} respondeu ${response.status} (${type}); esperado 404`);
    }
  } catch (error) {
    failures.push(`${path} não pôde ser verificado: ${error instanceof Error ? error.message : String(error)}`);
  }
}

try {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();
  for (const key of ['database', 'observability', 'geminiActive']) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      failures.push(`/api/health expõe detalhe interno "${key}"`);
    }
  }
} catch (error) {
  failures.push(`/api/health não pôde ser verificado: ${error instanceof Error ? error.message : String(error)}`);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`[verify-production-surface] ${failure}`);
  process.exit(1);
}

console.log(`[verify-production-surface] OK: ${baseUrl} não expõe fontes, sourcemaps ou detalhes internos.`);
