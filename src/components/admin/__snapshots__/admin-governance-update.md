Arquivo de rastreio transitório para esta tarefa:

Novos ficheiros:
- src/components/admin/AdminPagination.tsx
- src/components/admin/AdminFeatureCatalog.tsx
- src/components/admin/AdminSubscriptionGovernance.tsx
- src/components/admin/AdminPricingUsageGovernance.tsx
- src/services/entitlementService.ts
- src/services/usageAlertService.ts

Objetivo:
- Paginacao 10/20/50/100 com selector de tamanho de pagina.
- Catálogo de funcionalidades por módulo/sub-módulo.
- Painel de governança SaaS com versoes, alertas, concedao e catalogo.
- Serviços de concessao e alertas de uso 70/90/100%.

Tipo de verificacao:
- npm run check passou apos as correções de tipo.
- Dev server voltou a responder HTTP 200 em localhost:3000.
