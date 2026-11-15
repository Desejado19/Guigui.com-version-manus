# Auditoria Playwright — Guigui.com (três perfis)

Data: 9 de novembro de 2026
Suite: `tests/audit-three-profiles.spec.ts` (7 grupos, 21 testes)
Evidência: `test-results/audit-report.jsonl` (uma linha JSON por verificação) + `test-results/final-report.json`
Servidor auditado: `http://127.0.0.1:3000` (Vite dev, PostgreSQL ligado)

---

## A. Âmbito e método

Auditoria funcional com Playwright a correr contra a aplicação real e a base de dados real:

- **Cidadão** (`cidadao.teste@guigui.com`), **Empresa** (`empresa.teste@guigui.com`, `businessId: biz-1`), **Administrador** (`admin.teste@guigui.com`).
- Cada teste faz login pela API, injeta o cookie de sessão `guigui_session` e navega na interface como um utilizador faria (clicar, escrever, submeter).
- A varredura de menus (`sweepSidebar`) descobre os módulos a partir do DOM e abre-os um a um, em vez de usar uma lista fixa de seletores.
- Cada verificação escreve uma linha de evidência em `test-results/audit-report.jsonl` com o resultado observado (não com o resultado esperado).
- Nenhuma operação financeira real, nenhum envio de notificações em massa e nenhuma eliminação de dados foi executada.
- Não foram contornadas políticas de autorização: quando o servidor devolveu 401/403, o resultado foi tratado como comportamento a auditar, não como obstáculo.

## B. Ambiente e dados

| Item | Observado |
|---|---|
| Stack | React 19 + Vite + Tailwind 4, Express + PostgreSQL |
| Utilizadores | 120 |
| Empresas | 123 |
| Eventos | 97 |
| Pedidos (orders) | 184 |
| Bilhetes | 179 |
| Pagamentos pagos | 99 |

Os KPIs do dashboard administrativo coincidem com `/api/admin/stats` (teste «KPIs do dashboard coincidem com /api/admin/stats»): users 120, companies 123, events 97, tickets 179, orders 184, paid payments 99.

## C. Correções aplicadas durante a auditoria

Cópia inconsistente no menu (pt-PT), corrigida na origem:

- `src/utils/i18n.ts`: «Categorias e etiquetas» → **Categorias e Etiquetas**; «Configurações globais» → **Configurações Globais**.
- `src/locales/pt-BR.ts`: `admin.team` «Equipe» → **Equipa**; `business.teamPermissions` → **Equipa e permissões**; `businessNavTeam` → **Equipa e Permissões**.

Correções na própria suite (falsos negativos, não defeitos da aplicação):

- Logout: a aplicação pede confirmação explícita («Cancelar» / «Sair»); o teste passou a confirmar a ação em vez de assumir saída imediata.
- Identidade da empresa: o vínculo correto é `currentUser.businessId` (a sessão devolve `biz-1`); o teste procurava `ownerId`/`email` no payload de `/api/businesses`, que não expõe esses campos.
- `trackErrors` deixou de anexar propriedades extra ao array de erros (isso fazia `toEqual([])` falhar mesmo sem erros).
- Rótulos do menu comparados sem sensibilidade a maiúsculas/acentos.

Verificação de tipos após as alterações: `npm run check` (`tsc --noEmit`) — **passa**.

## D. Resultados por área

Execução final completa da suite: **15 passaram, 4 falharam, 1 não executado** (duração 376 s, 1 worker).

| Área | Verificações executadas | Resultado |
|---|---|---|
| Autenticação (UI) | Credenciais inválidas mostram erro; credenciais válidas abrem o painel; terminar sessão (com confirmação) devolve ao estado público | ✅ 3/3 |
| Cidadão | Varredura de 7 secções sem erros de runtime; perfil persiste após reload; notificações | ✅ 2/2 (marcar todas: indisponível) |
| Cidadão — suporte (UI) | Abrir «+ Novo pedido», preencher e enviar; pedido deve aparecer na lista | ❌ falhou |
| Cidadão — compra (UI) | Abrir modal de compra, aceitar política, confirmar pagamento | ❌ falhou |
| Empresa | Varredura de 14 módulos sem erros de runtime; ficha de negócio correta (`biz-1`) | ✅ 2/2 |
| Empresa — evento | Criar evento e vê-lo no painel e na plataforma pública | ❌ falhou (painel) |
| Empresa — equipa | Convite com e-mail inválido deve produzir mensagem | ❌ falhou |
| Administração | Varredura de 16 módulos sem erros; KPIs; decisão sobre empresa com auditoria; pesquisa de utilizadores | ✅ 4/4 |
| Segurança | `/api/admin/*` recusa visitante (401) e cidadão (403); empresa não escreve noutra empresa (403); cookie httpOnly e 0 tokens em localStorage | ✅ 3/3 |
| Consistência entre centros | Evento da empresa visível ao cidadão e ao administrador; pedido de suporte do cidadão visível na fila do admin | ✅ 2/2 |
| Responsividade | Sem overflow horizontal em 375/768/1024/1440 px na home e nos três painéis | ✅ 4/4 |

## E. Falhas encontradas (por prioridade)

### Alta

1. **Suporte do cidadão não submete pela interface.** O formulário abre, os campos aceitam texto e o botão «Enviar pedido» é clicável, mas **nenhum pedido `POST /api/support/tickets` é emitido**. Evidência do run final:
   `{"kind":"citizen-support","httpStatus":null,"onServer":false,"apiCalls":[…,"← 200 /api/support/tickets/mine","← 200 /api/conversations"]}` — a última chamada é uma leitura da lista; não existe POST.
   Consequência: o pedido nunca é criado e o utilizador não recebe qualquer mensagem de erro. O caminho de API equivalente funciona (ver grupo 6), pelo que o defeito está no handler do formulário (`CommunicationHub.submitSupport` → `onCreateSupport`), que retorna antes de chamar a API sem informar o utilizador.

2. **Compra de bilhete não conclui pela interface.** Depois de aceitar a política e clicar em «Confirmar e Pagar», o modal permanece aberto, não aparece alerta e a contagem de bilhetes do cidadão não muda (49 → 49). Também aqui **não é emitido nenhum pedido `POST /api/tickets/purchase`**. O `handleSubmit` do modal valida e chama `onConfirm`, mas a chamada não chega à rede.

3. **Painel da empresa não mostra os eventos da própria empresa.** A secção «Eventos» apresenta «Nenhum evento criado pelo seu estabelecimento ainda» apesar de a empresa `biz-1` ter bilhetes vendidos (155 no total da plataforma) e de o evento criado no teste existir na API pública. É uma inconsistência de dados visível ao utilizador.

### Média

4. **Convite de equipa aceita e-mail inválido sem feedback.** Não é mostrada qualquer mensagem de validação («inválido/obrigatório/correto/erro») após submeter um endereço mal formado.

5. **Seis leituras proibidas em cada abertura do painel da empresa.** O cliente pede chaves de estado que o servidor recusa:
   `403 /api/app-state/guigui_subscription_plans`, `guigui_monetization_catalog`, `guigui_admin_business_model_config`, `guigui_conversations`, `guigui_conversation_messages`, `guigui_support_requests`.
   O painel continua a funcionar (usa valores por omissão), mas gera ruído na consola e mostra planos/catálogo desatualizados. Tentou-se bloquear essas leituras em `src/utils/persistentState.ts`; os 403 mantiveram-se, pelo que a alteração foi revertida e a causa fica por isolar (a leitura não passa pelo filtro `canReadKeyForScope` no momento em que é disparada).

### Baixa

6. **Marcar todas as notificações do cidadão não está disponível** na vista auditada (`markAllAvailable: false`).
7. **Ligeiras inconsistências de capitalização** em rótulos administrativos («Categorias e etiquetas», «Equipe» em pt-PT) — corrigidas na origem nesta auditoria, a confirmar visualmente no próximo run.

## F. Segurança e autorização (backend)

Executado com pedidos diretos ao servidor, sem contornar políticas:

| Verificação | Resultado observado |
|---|---|
| `/api/admin/stats` sem sessão | 401 |
| `/api/admin/stats` como cidadão | 403 |
| `/api/admin/users` como cidadão | 403 |
| `PATCH /api/businesses/:id/profile` de outra empresa, autenticado como empresa | 403 (`business_profile_update_denied` registado na auditoria) |
| Cookie de sessão | `httpOnly: true` |
| Tokens em `localStorage` | 0 |
| Mutação de empresa alheia aceite | não |

Observação de robustez: a rota `PATCH /api/businesses/:id/profile` valida o corpo **antes** de decidir a autorização. Com um corpo inválido devolve 400 a quem não tem posse da empresa; não expõe dados, mas a ordem correta é autorizar e só depois validar.

## G. Consistência entre centros

- Evento criado pela empresa (`businessId: biz-1`) fica consultável em `/api/events` e é visto pelo cidadão e pelo administrador. ✅
- Pedido de suporte criado pelo cidadão aparece na fila do administrador. ✅
- KPIs administrativos iguais aos totais da base de dados. ✅
- Inconsistência: o mesmo evento criado pela empresa não aparece no painel «Eventos» da empresa. ❌ (item E.3)

## H. Limitações e pendências

- A suite completa foi executada com `--workers=1` (376 s). Não foi executada com o `workers: 2` do `playwright.config.ts`.
- Não foram usadas ferramentas de acessibilidade (axe-core/Lighthouse) por não estarem instaladas; a responsividade foi medida por overflow horizontal, não por auditoria visual completa.
- O teste de «notificações em massa» não foi executado: a ação de envio em massa não ficou exposta na interface durante a auditoria. Deve ser validado manualmente antes de qualquer envio real.
- O perfil do cidadão persiste apenas em `localStorage`; não existe rota de atualização de perfil no servidor.
- Pendente de correção: submissão de suporte (E.1), compra de bilhete (E.2), listagem de eventos da empresa (E.3), validação do convite de equipa (E.4) e origem dos 403 de estado (E.5).
