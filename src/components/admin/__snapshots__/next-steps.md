Próximos passos já escolhidos para integracao:

1. SubmoduleNavbar
- Agora aceita currentLang opcional, page, pageSize, totalItems, onPageChange, onPageSizeChange.
- Quando totalItems > 0 e onPageChange estiver presente, renderiza AdminPagination abaixo dos pills.
- AdminPagination foi ajustado para aceitar currentLang e nao depender de utilitario de lingua global.

2. EventosView
- SubmoduleNavbar ja existe aki.
- Pagination nao adicionada agora porque o View e orientado para agenda/reminders, nao para listas paginadas.

3. AdminDashboard
- Novos modulos de governanca (AdminSubscriptionGovernance, AdminPricingUsageGovernance) e catálogo (AdminFeatureCatalog) podem usar SubmoduleNavbar + AdminPagination quando forem expostos como tabs listas.
- A decision de quais tabs recebem paginação fica para ligacao direta ao AdminDashboard, usando os props que ja existem no SubmoduleNavbar.

4. Seguimento
- Se quiser, posso agora:
  - ligar SubmoduleNavbar + pagination em uma ou duas tabs de lista do AdminDashboard como exemplo;
  - ou ampliar o glassmorphism em index.css para sidebar, cards, inputs e botoes;
  - ou preparar a integracao de realtime/storage no painel admin.
