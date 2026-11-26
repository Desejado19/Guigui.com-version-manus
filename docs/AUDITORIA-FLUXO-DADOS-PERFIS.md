# Auditoria do fluxo de dados — Guigui.com

**Data:** 2026-10-04  
**Perfis analisados:** User/Cidadão, Empresa e Administração  
**Ambiente:** fallback local JSON, sem PostgreSQL configurado

## Resultado executivo

Os três perfis partilham o mesmo estado de aplicação, mas usam dois mecanismos de persistência: `localStorage` para resposta imediata e APIs do servidor para persistência e sincronização. A autenticação, isolamento de permissões, comunicação e bilhetes estão implementados e os testes unitários passaram.

Foi encontrado e corrigido um desalinhamento importante nos fluxos de comunicação: a interface criava cópias locais de conversas/tickets mesmo quando a API rejeitava o pedido. Também mostrava a descrição inicial de um ticket como uma resposta, embora o backend a guarde como descrição do ticket.

## Fluxos verificados

### User/Cidadão

- Login e sessão via `/api/auth/login` e `/api/auth/session`.
- Bilhetes sincronizados a partir de `/api/tickets/mine`.
- Notificações lidas a partir de `/api/notifications`.
- Conversas comerciais criadas e enviadas através de `/api/conversations`.
- Suporte criado em `/api/support/tickets` e respostas em `/api/support/tickets/:id/replies`.
- Acesso de escrita a empresas/eventos bloqueado pelo servidor.

### Empresa

- Sessão associada a `businessId`.
- Conversas filtradas pela empresa associada.
- Eventos e ficha da empresa persistidos através de `app-state` e endpoints estruturados.
- Scanner valida bilhetes associados aos eventos da empresa.
- Tickets de suporte filtrados pela empresa.
- Permissões de tenant verificadas pelos testes de segurança.

### Administração

- Acesso às métricas, empresas, moderação, suporte, auditoria e configurações.
- Suporte listado com escopo global.
- Estado de tickets alterado exclusivamente em `/api/support/tickets/:id/status`.
- Conversas comerciais não são apresentadas como canal operativo de administração; o suporte permanece o canal apropriado.
- Testes de isolamento impedem operações privilegiadas por utilizadores ou empresas.

## Correções aplicadas

### 1. Conversa comercial rejeitada pela API

Antes, se `POST /api/conversations` falhasse, a app criava uma conversa com um ID fictício apenas no navegador. Essa conversa desaparecia no polling seguinte e podia induzir o utilizador a pensar que a mensagem tinha sido enviada.

Agora, a interface só cria a conversa local depois de receber uma resposta válida com `id`. Em erro de rede ou resposta não-2xx, o fluxo termina sem criar um registo fantasma e deixa o erro registado para diagnóstico.

### 2. Ticket de suporte rejeitado pela API

Antes, um ticket era sempre adicionado ao estado local mesmo quando o servidor recusava a criação.

Agora, o ticket só entra na lista depois de `/api/support/tickets` devolver um ticket persistido.

### 3. Primeira descrição do suporte

Antes, a descrição era duplicada como `replies[0]` na interface, mas não era persistida como uma resposta no servidor. O polling apagava essa resposta aparente.

Agora, a descrição permanece no ticket e `replies` começa vazio, alinhado com o contrato real do backend.

### 4. Respostas e estados de suporte

As respostas e alterações de estado continuam optimistas para manter a interface rápida, mas agora fazem rollback para o estado anterior quando o servidor devolve erro ou a rede falha.

## Validações

- `npm run check` — **passou**.
- `npm run test:unit` — **238 passaram; 19 ignorados**.
- `npm run test:components` — **40 passaram**.
- `npm run build` — **passou**.
- `npm run test:i18n` — **5 idiomas e 623 chaves verificadas**.
- `LOAD_BASE_URL=http://127.0.0.1:3000 npm run test:load` — **100/100 pedidos sem erro**.
- Health local — **OK**.
- URL pública temporária — **HTTP 200**.

## Limitações conhecidas

- O teste Playwright E2E não pôde arrancar porque o executável Chromium não está instalado neste sandbox. O erro é de ambiente (`Executable doesn't exist`), não uma falha da aplicação. Para concluir essa camada, executar `npx playwright install chromium` e repetir `npm run test:e2e`.
- A execução original de `npm run test:load` apontou para a porta 3013, onde não havia servidor. Repetida contra a porta activa 3000, passou integralmente.
- O servidor activo está em modo fallback local: `database.configured=false` e `database.connected=false`. Para validação PostgreSQL real, iniciar o serviço com `DATABASE_URL` configurada.
- O relatório de dívida de tradução ainda identifica texto fixo em vários componentes. A paridade dos catálogos está completa, mas a migração de todos os textos existentes para chaves i18n é uma fase separada.

## Estado final

O fluxo de comunicação dos três perfis deixou de confirmar operações que não foram persistidas. O estado mostrado no User, Empresa e Admin está agora alinhado com as respostas efectivas da API, com rollback nos erros de suporte e sem duplicação da descrição inicial dos tickets.
