---
name: owasp-security
description: Revisao de seguranca contra o OWASP Top 10 no Guigui.com (sessao por cookie, Express, PostgreSQL, uploads, pagamentos). Usar ao revisar autenticacao, rotas de escrita, formularios, uploads e integracoes.
---

# OWASP Top 10 — Guigui.com

## A1/A7 — Controlo de acesso e autenticacao

- Sessao em cookie httpOnly; o frontend tambem guarda `localStorage['guigui_current_user']` **apenas para apresentacao** — nunca como prova de identidade.
- Toda a escrita passa por verificacao no servidor (ver `server/platformWriteAccess.ts`).
- Logout invalida a sessao no servidor, nao so no browser.
- Nunca confiar em `role` enviado pelo cliente.

## A2 — Falhas criptograficas

- Palavras-passe com hash lento (bcrypt/argon2), nunca texto simples nem MD5/SHA1.
- Segredos (email, SMS, pagamentos) so em variaveis de ambiente. `.env` fora do repositorio.
- Sem dados sensiveis em logs: telefone mascarado, sem tokens nem PINs.

## A3 — Injecao

- SQL sempre parametrizado (ver `postgresql-expert`).
- Conteudo do utilizador renderizado como texto, nunca `dangerouslySetInnerHTML` com dados da API.
- `URL` e `path` validados antes de abrir ficheiros ou redirecionar.

## A4 — Design inseguro

- Limites por utilizador em acoes sensiveis (comprar, publicar, enviar mensagem) — `server/rateLimitService.ts`.
- Idempotencia nas compras (`purchaseIdempotencyKey`) para evitar cobranca/emissao dupla.
- Stock validado em transacao com `FOR UPDATE`.

## A5 — Configuracao incorreta

- `NODE_ENV` correto; mensagens de erro genericas em producao.
- CORS restrito; cookies com `Secure` + `SameSite` em producao.
- Rotas de diagnostico protegidas por admin.

## A6 — Componentes vulneraveis

- `npm audit` antes de adicionar/atualizar dependencia; justificar cada nova.

## A8/A9 — Integridade e registo

- Auditoria de acoes administrativas em `audit_logs` (quem, quando, antes/depois).
- Webhooks de pagamento validados por assinatura e tolerancia temporal.

## A10 — SSRF

- Nenhum pedido do servidor a URL fornecida pelo utilizador sem lista de destinos permitidos.

## Checklist rapido

- [ ] Rota nova verifica sessao e permissao?
- [ ] Entrada validada e limitada em tamanho?
- [ ] Erro nao revela estrutura interna?
- [ ] Acao repetivel tem idempotencia?
- [ ] Evento sensivel ficou registado na auditoria?
