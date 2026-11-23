# Email externo (`external_email`)

Canal para uma pessoa autenticada (cidadão, empresa ou administração) escrever
para um destinatário **fora** da plataforma. O `From` é sempre o endereço
verificado do Guigui.com — o único que alinha com SPF/DKIM/DMARC — e a
identidade de quem escreve viaja no nome de exibição e no `Reply-To`, para que
a resposta vá directamente para essa pessoa.

O código vive em `server/email/` (transporte, dispatcher, validação, layout,
repositório) e a rota em `server.ts`. A interface é o `ExternalEmailComposer`
(`src/components/communication/ExternalEmailComposer.tsx`), encaixado no painel
de administração em **Suporte → Email externo** e aberto como diálogo a partir
do hub de comunicação.

## O que este canal não é

- **Não tem modo simulado.** Um email escrito por uma pessoa não pode ser dado
  como enviado quando não saiu; sem fornecedor configurado a rota falha com
  `503`. Os fluxos automáticos (convites de equipa, entrega de bilhetes) têm o
  seu próprio modo simulado — este não.
- **Não substitui as mensagens internas.** Se o destinatário tiver conta no
  Guigui.com, a rota recusa com `409` e a UI encaminha para as mensagens da
  plataforma.
- **Não é um canal de marketing.** É uma mensagem pontual, assinada por uma
  pessoa, com limite por utilizador.

## Quem pode usar

A rota exige sessão válida (`requireSession`) e uma conta com email associado.
Cidadãos e contas empresariais não têm `adminAccess` e não são filtrados por
módulo. Colaboradores administrativos com acesso granular só podem usar o canal
se o módulo `external_email` lhes for concedido.

O módulo está em `src/config/teamAccess.ts` (`ADMIN_ACCESS_MODULES`):

```ts
{ id: 'external_email', label: 'Email externo', actions: ['view', 'create'] }
```

`view` mostra a entrada na navegação; `create` autoriza o envio
(`canPerformAction(adminAccess, 'external_email', 'create')`). Os perfis de
super administrador não guardam `adminAccess` e mantêm acesso total.

Uma recusa por falta do módulo responde `403 MODULE_FORBIDDEN`, inclui
`module: "external_email"` e fica registada na auditoria como
`authorization_denied` com `metadata.requiredModule = 'external_email'`.

## Contrato

`POST /api/emails/external` (também acessível em `/api/v1/emails/external`).

Pedido:

```json
{
  "to": "cliente@exemplo.com",
  "subject": "Resposta ao seu pedido",
  "message": "Bom dia,\n\nObrigado pelo contacto…",
  "requestId": "0f5c1c0e-6c0f-4a41-9d3e-2c1e0b7a9f11"
}
```

| Campo | Regra |
|---|---|
| `to` | Obrigatório; endereço válido, máximo 254 caracteres; não pode ser o endereço da própria conta |
| `subject` | Obrigatório; quebras de linha colapsadas; máximo **150** caracteres |
| `message` | Obrigatório; texto simples, máx. **4000** caracteres; caracteres de controlo removidos; parágrafos separados por linha em branco |
| `requestId` | Opcional; chave de idempotência (`external:<userId>:<requestId>`, truncada a 120 caracteres) |

Sucesso:

```json
{ "state": "accepted", "reference": "dlv_01HZ…" }
```

`accepted` significa apenas que o fornecedor aceitou a mensagem (2xx HTTP ou
aceitação SMTP). `delivered`, `bounced` e `complained` só podem vir de
confirmação do fornecedor (webhook), nunca da resposta do envio.

Repetir o mesmo `requestId` **não reenvia**: o dispatcher devolve o registo já
existente (deduplicado), pelo que a resposta `202` e a referência se mantêm.

## Estados e códigos

| Estado | `code` | Quando acontece |
|---|---|---|
| `202` | — | Fornecedor aceitou a mensagem. Corpo: `{ state: "accepted", reference }` |
| `400` | `EXTERNAL_EMAIL_INVALID` | Falta `to`, `subject` ou `message` no corpo do pedido |
| `400` | `SUBJECT_MISSING` · `SUBJECT_TOO_LONG` | Assunto vazio (após normalização) ou acima de 150 caracteres |
| `400` | `MESSAGE_MISSING` · `MESSAGE_TOO_LONG` | Mensagem vazia ou acima de 4000 caracteres |
| `400` | `RECIPIENT_INVALID` · `RECIPIENT_IS_SENDER` | Destinatário inválido ou igual ao email de quem envia |
| `401` | `AUTHENTICATION_REQUIRED` | Sem sessão válida |
| `403` | `MODULE_FORBIDDEN` | Colaborador administrativo com acesso granular sem o módulo `external_email` (`module: "external_email"`, auditado) |
| `409` | `ACCOUNT_EMAIL_REQUIRED` | A conta autenticada não tem email associado — não há `Reply-To` possível |
| `409` | `RECIPIENT_IS_PLATFORM_MEMBER` | O destinatário tem conta no Guigui.com; usar as mensagens internas |
| `429` | `EXTERNAL_EMAIL_RATE_LIMITED` | Limite de **20 emails por hora por utilizador** (`email:external:<userId>`, contador distribuído) |
| `502` | `EXTERNAL_EMAIL_FAILED` | O fornecedor recusou ou falhou após as tentativas; o corpo inclui `state` do registo de entrega |
| `503` | `EMAIL_NOT_CONFIGURED` | Não há fornecedor real configurado (ou configuração incompleta); este canal nunca simula |

Cada envio aceite grava auditoria `external_email_sent` com
`metadata.state` e `metadata.deduplicated`.

A UI do compositor traduz os casos que o utilizador pode resolver: `400`
(campos a corrigir), `409` (destinatário interno), `429` (limite), `503`
(canal por configurar) e falha genérica para `5xx`.

## Configuração

A configuração é resolvida **apenas** do ambiente, em `server/email/config.ts`.
Nunca há detecção implícita de servidor nem credenciais por omissão.

```dotenv
EMAIL_PROVIDER=          # auto (por omissão) | brevo | smtp | none
BREVO_API_KEY=           # fornecedor real via API
EMAIL_FROM=              # "Guigui.com <no-reply@guigui.com>" — obrigatório em produção
EMAIL_FROM_NAME=Guigui.com
EMAIL_REPLY_TO=          # opcional, para fluxos automáticos
EMAIL_MAX_ATTEMPTS=3     # 1..5
EMAIL_RETRY_BASE_DELAY_MS=500
SMTP_HOST=               # alternativa ao Brevo
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_SECURE=false
```

- `EMAIL_PROVIDER=none` desliga o envio: a rota responde `503`.
- Sem `BREVO_API_KEY` **e** sem `SMTP_HOST` a configuração não fica pronta: `503`.
- Em produção, sem `EMAIL_FROM` válido a configuração também não fica pronta.
- `EMAIL_PROVIDER=smtp` com `SMTP_HOST=127.0.0.1` ou porta `1025` é uma caixa
  local (Mailpit): as mensagens não saem da máquina.
- A composição do dispatcher é reutilizada depois de resolvida; uma falha de
  configuração não fica memorizada, pelo que corrigir o ambiente volta a
  funcionar sem reiniciar o processo.
- O DNS do domínio do `EMAIL_FROM` (SPF, DKIM, DMARC) é responsabilidade da
  operação — sem isso os emails saem mas caem em spam ou são rejeitados.

## Operação e diagnóstico

- Cada mensagem lógica é uma linha em `email_deliveries`
  (`db/migrations/025_email_deliveries.sql`), com `status`, `attempts`,
  `provider_message_id`, último erro e `dedupe_key` única.
- As tentativas são síncronas, com backoff exponencial
  (`EMAIL_RETRY_BASE_DELAY_MS * 2^(n-1)`, tecto de 30 s) e no máximo
  `EMAIL_MAX_ATTEMPTS`. O pedido só responde depois de esgotar as tentativas:
  um `502` pode demorar alguns segundos.
- Para investigar um `502`, procurar o `reference`/`deliveryId` devolvido no
  corpo e ler `status`, `last_error_code` e `last_error_message` na tabela. Os
  logs do servidor registam `external-email-failed` com `userId` e nome do erro,
  sem conteúdo da mensagem.
- Para investigar um `503`, verificar `EMAIL_PROVIDER`, `BREVO_API_KEY` /
  `SMTP_HOST` e `EMAIL_FROM` no ambiente do processo em execução.

## Testes

```bash
npx vitest run tests/unit/externalEmailRoutes.test.ts tests/unit/externalEmail.test.ts
```

`externalEmailRoutes.test.ts` cobre os estados HTTP (incluindo `403`
`MODULE_FORBIDDEN` e os limites de validação) e `externalEmail.test.ts` cobre
composição, normalização, idempotência e falha de configuração.
