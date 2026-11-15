import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    plugins: [react(), tailwindcss()],
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
      allowedHosts: (process.env.VITE_ALLOWED_HOSTS || 'localhost,127.0.0.1,::1')
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
