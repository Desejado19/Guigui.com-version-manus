# Testes de carga — Guigui.com (k6)

Testes de desempenho contra os endpoints **reais** do servidor (`server.ts`).
Não inventam rotas, contas ou respostas, e por omissão **não escrevem dados**.

## Pré-requisitos

- Servidor a correr (`dist/server.mjs` ou `npm run dev`) em `http://127.0.0.1:3000`.
- k6 instalado (`k6 version`).
- Contas de demonstração: `cidadao.teste@guigui.com`, `cidadao.seed02@guigui.test`,
  `empresa.teste@guigui.com`, `admin.teste@guigui.com`.

## Ficheiros

| Ficheiro | Endpoints reais | Escreve? |
|---|---|---|
| `health-check.js` | `/api/health`, `/api/features`, `/api/locations` | Não |
| `authentication.js` | `/api/auth/login`, `/api/auth/session`, `/api/auth/logout` | Não (só sessões) |
| `feed.js` | `/api/posts` (+ `neighborhood`, `q`), `/api/posts/engagements`, `/api/sync/bootstrap`, `/api/businesses` | Não |
| `publications.js` | `/api/businesses`, `/api/businesses/featured`, `/api/businesses/:id/reviews`, `/api/businesses/:id/post-metrics` | Não |
| `interactions.js` | `/api/posts/engagements`, `/api/posts/:id/reaction`, `/api/posts/:id/share` | Só com `ALLOW_WRITES=1` |
| `stories.js` | `/api/sync/bootstrap` (`data.stories`) | Não |
| `events.js` | `/api/events`, `/api/marketing/scheduled-items/public` | Não |
| `tickets.js` | `/api/tickets/mine`, `/api/tickets/sold`, `/api/events` | Não |
| `websocket.js` | `GET /api/posts/engagements/stream` (SSE; o projeto não usa WebSocket) | Não |
| `full-platform.js` | misto dos anteriores (60/15/15/10) | Só com `ALLOW_WRITES=1` |
| `stress.js` | `/api/posts` a taxas crescentes até `TARGET_RPS` | Não |
| `soak.js` | `/api/posts` + `/api/events` a carga constante | Não |

## Execução

```bash
# fumo (5 utilizadores, 20 s)
k6 run -e VUS=5 -e DURATION=20 tests/load/full-platform.js

# progressivo (sempre depois de o patamar anterior estar limpo)
k6 run -e VUS=100  -e DURATION=90 tests/load/full-platform.js
k6 run -e VUS=250  -e DURATION=90 tests/load/full-platform.js
k6 run -e VUS=500  -e DURATION=120 tests/load/full-platform.js
k6 run -e VUS=1000 -e DURATION=120 tests/load/full-platform.js
k6 run -e VUS=2500 -e DURATION=180 tests/load/full-platform.js
k6 run -e VUS=5000 -e DURATION=180 tests/load/full-platform.js
k6 run -e VUS=50000 -e DURATION=300 tests/load/full-platform.js
```

Cada script individual aceita o mesmo `VUS`/`DURATION`:

```bash
k6 run -e VUS=100 -e DURATION=60 tests/load/feed.js
k6 run -e VUS=100 -e DURATION=60 tests/load/interactions.js
```

Resumo em JSON para relatório:

```bash
k6 run --summary-export tests/load/results/feed-100.json -e VUS=100 tests/load/feed.js
```

## Cache de respostas comprimidas

O servidor guarda o corpo comprimido de respostas **públicas** (sem cookie, sem
`Authorization`, sem `Set-Cookie`) durante 5 s — configurável com
`HTTP_COMPRESSION_CACHE_TTL_MS` (0 desliga). A chave inclui URL e `Accept-Language`.
Cada resposta comprimida traz `X-Compression-Cache: hit|miss`, útil para confirmar
o comportamento:

```bash
curl -sD - -o /dev/null -H 'Accept-Encoding: gzip' localhost:3000/api/sync/bootstrap | grep -i x-compression-cache
```

## Paginação e payload leve

`/api/businesses` e `/api/sync/bootstrap` aceitam parâmetros opcionais (sem eles a
resposta mantém-se completa, como antes):

| Parâmetro | Endpoints | Efeito |
|---|---|---|
| `limit` (1–200) | ambos | tamanho da página |
| `offset` (≥0) | ambos | início da página |
| `view=summary` | ambos | remove `posts`, `gallery`, `promotions`, `reviews`, `metrics` e campos internos de subscrição |
| `sections` | bootstrap | `businesses,events,posts,promotions,stories` — só lê as secções pedidas |

Exemplos:

```bash
curl '/api/businesses?limit=20&view=summary'
curl '/api/sync/bootstrap?sections=businesses&limit=20&view=summary'
curl '/api/sync/bootstrap?sections=stories'
```

Respostas paginadas incluem `pagination: { total, limit, offset, hasMore, nextOffset }`;
parâmetros inválidos devolvem `400` (`INVALID_PAGINATION`, `INVALID_BOOTSTRAP_SECTIONS`).
O feed (`/api/posts`) não foi alterado.

## Compressão nas medições

Os pedidos enviam `Accept-Encoding: gzip, deflate` (o k6 não o faz por omissão) e o
servidor responde com brotli ou gzip. Para medir sem compressão, compare com os
resultados anteriores à alteração ou envie `Accept-Encoding: identity` num pedido
isolado (`curl -H 'Accept-Encoding: identity'`).

## Variáveis

| Variável | Omissão | Uso |
|---|---|---|
| `BASE_URL` | `http://127.0.0.1:3000` | origem do servidor |
| `VUS` | `100` | patamar de utilizadores virtuais |
| `DURATION` | `60`–`90` s | duração total do perfil |
| `THINK_TIME` | `1` | pausa entre iterações (s) |
| `ALLOW_WRITES` | — | `1` liga gosto/partilha; o gosto é retirado logo a seguir |
| `ALLOW_SHARES` | — | `1` (com `ALLOW_WRITES=1`) liga partilhas — incrementa contadores reais |
| `SSE_HOLD_MS` | `1200` | tempo de espera do stream no teste de tempo real |

## Monitorização de recursos

`monitor.mjs` regista CPU/RAM do processo do servidor, ligações PostgreSQL reais
(`pg_stat_activity`, via `DATABASE_URL` do `.env`) e o estado do canal de tempo real:

```bash
node tests/load/monitor.mjs <PID-do-servidor> 2000   # → tests/load/results/monitor.jsonl
```

Resultados das execuções já feitas e conclusões estão em `RELATORIO.md`.

## Segurança

- Só contas de demonstração/teste; nenhum pagamento (`/api/payments/*`) é chamado.
- Nenhum teste apaga ou edita dados: as escritas possíveis são gosto (revertido) e
  partilha (opt-in explícito).
- Não apontar para produção sem autorização e sem limites acordados.
- O servidor de desenvolvimento limita a 30 000 pedidos/minuto por IP
  (`RATE_LIMIT_MAX_REQUESTS`); acima disso aparecem `429` que não são do teste.

## Limitações conhecidas

- O projeto **não usa WebSocket**; `websocket.js` mede o handshake SSE.
- Não há Redis; o tempo real usa PostgreSQL `LISTEN/NOTIFY`.
- `k6` corre no mesmo computador do servidor: CPU/RAM medidos incluem o gerador de carga.
