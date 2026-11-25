# Notas de validação — auditoria de bilhética

Data da validação: 29-08-2026.

## Preview visual

O preview abriu em `https://3000-iku7lz1w9ir0xw5zfd6o1-b3e65758.us3.manus.computer/`. A homepage renderizou o cabeçalho Guigui.com, pesquisa, directório, descontos, Agenda Cultural & Bilhetes, mensagens, notificações e área de sessão. A screenshot mostrou layout responsivo, tema escuro legível no painel superior e um alerta de lembrete de evento com botão de fechar. Não foram observados erros de carregamento na página.

## Backend/API

`GET /api/health` respondeu 200 com `status: ok`.

A auditoria end-to-end criou duas credenciais para uma compra de quantidade 2, confirmou códigos QR/PIN distintos, titular separado, lookup por telefone do titular e idempotência pela mesma `Idempotency-Key`. O segundo pedido devolveu os mesmos `ticketIds` e códigos, sem emitir duplicados.

`POST /api/tickets/resend-sms` respondeu como simulação explícita e a repetição imediata foi recusada com HTTP 429 e `SMS_COOLDOWN`. O endpoint não afirma ligação real a uma operadora.

## Limitações mantidas honestamente

O servidor ainda não possui uma fonte canónica transaccional de eventos/inventário, reservas temporárias com lock, operadores individuais, SMS comercial, payout/hold ou sincronização offline segura. O scanner continua online-only; não foi introduzido cache local que pudesse criar bypass de controlo de acesso.
