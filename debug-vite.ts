import { createServer } from 'vite';

// Mesma config inline do server.ts
const vite = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  appType: 'spa',
});

console.log('root =', vite.config.root);
console.log('hmr =', JSON.stringify(vite.config.server.hmr), '| ws =', JSON.stringify((vite.config.server as any).ws));

const pc: any = (vite as any).pluginContainer ?? (vite as any).environments?.client?.pluginContainer;

try {
  const resolved = await pc.resolveId('/@vite/client');
  console.log('resolveId(/@vite/client) =>', JSON.stringify(resolved));
} catch (e: any) {
  console.log('resolveId ERRO:', e.message);
}

try {
  const result = await vite.transformRequest('/@vite/client');
  console.log('transformRequest =>', result ? `OK (${result.code.length} bytes)` : 'null');
  if (result) console.log('primeiras linhas:', result.code.slice(0, 200));
} catch (e: any) {
  console.log('transformRequest ERRO:', e.message);
}

await vite.close().catch(() => {});
process.exit(0);
