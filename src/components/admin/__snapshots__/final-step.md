Resultado final deste passo:

1. Federation AdminDashboard e modulos novos
- Actualizei as importacoes do AdminDashboard para incluir os modulos de governanca.
- Foi feita uma ligacao inicial controlada por prop, sem alterar os tabs ja existentes ou regras comerciais.

2. SubmoduleNavbar com paginação opcional
- O SubmoduleNavbar agora suporta props de paginação e renderiza AdminPagination quando totalItems > 0.

3. Glassmorphism mais amplo
- Adicionadas classes utilitarias no index.css: glass-subtle, glass-strong, glass-sidebar, glass-card-soft, glass-input-dashboard, glass-button-dashboard, glass-select-dashboard, glass-chip-dashboard, glass-badge-dashboard, glass-panel-header.
- Mantidas as classes ja existentes.

4. Verificacao
- npm run check passou.
- O dev server responde HTTP 200 em localhost:3000.

O que nao foi feito aqui e que fica para posso continuar com foco:
- aplicar efectivamente as classes glass nos paineis do AdminDashboard e BusinessDashboard;
- escolher quais tabs do AdminDashboard recebem SubmoduleNavbar + AdminPagination em producao.
