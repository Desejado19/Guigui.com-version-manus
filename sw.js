// Service Worker vazio - desativado para evitar problemas de cache
// Este arquivo substitui qualquer Service Worker antigo registrado no navegador
console.log('[Guigui PWA] Service Worker vazio carregado - cache desativado');
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  // Não cacheia nada - permite que todas as requisições vão direto para o servidor
});
self.addEventListener('fetch', () => {
  // Não intercepta nenhuma requisição - deixa passar direto para o servidor
});