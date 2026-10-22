import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Permite a pré-visualização através do domínio público temporário.
      allowedHosts: true as const,
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
