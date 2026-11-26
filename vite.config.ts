import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    plugins: [react(), tailwindcss()],
    // O esbuild 0.28.2 marca o destructuring como não suportado no target
    // `safari14` (na realidade o Safari suporta destructuring desde o 7.1) e
    // aborta o `vite build` ao tentar transpilá-lo, algo que ainda não
    // implementa. Declaramos o suporte real para evitar essa transformação
    // impossível, sem alterar os targets de browser nem a versão do esbuild.
    esbuild: {
      supported: {
        destructuring: true,
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      sourcemap: !isProduction,
    },
    server: {
      // Allowlist de hosts para desenvolvimento local autorizado.
      // Em produção o Vite não é utilizado (build servido pelo Express).
      // Inclui o domínio do túnel ngrok usado para aceder ao dev server fora da
      // rede local. `allowedHosts: true` fica de fora de propósito: aceitar
      // qualquer hostname anularia a proteção contra DNS rebinding.
      allowedHosts: (
        process.env.VITE_ALLOWED_HOSTS
        || 'localhost,127.0.0.1,::1,nephew-monotype-surreal.ngrok-free.dev'
      )
        .split(',')
        .map((host) => host.trim())
        .filter(Boolean),
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        // Em Windows, um ficheiro bloqueado na raiz (log/backup/artefacto) fazia o
        // watcher terminar com EBUSY e derrubava o servidor de desenvolvimento.
        // `src/`, `public/` e `data/` continuam observados normalmente.
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/build/**',
          '**/backups/**',
          '**/playwright-report/**',
          '**/test-results/**',
          '**/*.log',
          '**/*.txt',
          '**/*.tmp',
          '**/*.out',
        ],
      },
    },
  };
});
