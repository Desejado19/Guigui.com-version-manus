# Relatório de testes de carga — Guigui.com

Data: 13 de novembro de 2026 · k6 v2.4.0 · servidor local `http://127.0.0.1:3000` (PID 24400, `dist/server.mjs`)

Todos os números abaixo vêm de execuções reais nesta máquina. Patamares de 2 500,
5 000 e 50 000 VUs **não foram executados** e a capacidade correspondente **não está
comprovada** — ver "Limitações".

## 1. Arquitetura auditada

| Componente | Estado real |
|---|---|
| Aplicação | Node + Express (`server.ts` → `dist/server.mjs`), porta **3000** |
| Base de dados | PostgreSQL local, porta **5432**, pool `pg` com `max: 5` (`server/db.ts`) |
| Redis | **Não existe** — nada escuta em 6379 e o código não tem cliente Redis |
| WebSocket | **Não existe** — tempo real por **SSE** + PostgreSQL `LISTEN/NOTIFY` (`server/realtimeBus.ts`) |
| Autenticação | `POST /api/auth/login` (email/password), cookie `guigui_session` HttpOnly, `SameSite=Lax`, 7 dias; sem CSRF ativo |
| Limite de tráfego | `express-rate-limit` em `/api`: 30 000 pedidos/min por IP (dev) |
| Compressão HTTP | **Nenhuma** (não há `compression` no servidor; ver §4) |
| Portas ocupadas durante os testes | 3000 (app) e 5432 (PostgreSQL) |

## 2. Endpoints usados

Todos existem em `server.ts`:

- Saúde e arranque: `/api/health`, `/api/features`, `/api/locations`
- Sessão: `/api/auth/login`, `/api/auth/session`, `/api/auth/logout`
- Feed: `/api/posts` (`?neighborhood=`, `?q=`), `/api/posts/engagements`, `/api/sync/bootstrap`, `/api/businesses`
- Publicações: `/api/businesses`, `/api/businesses/featured`, `/api/businesses/:id/reviews`, `/api/businesses/:id/post-metrics`
- Interações: `/api/posts/:postId/reaction`, `/api/posts/:postId/share`
- Stories: incluídas em `/api/sync/bootstrap` (`data.stories`) — não há rota própria
- Eventos: `/api/events`, `/api/marketing/scheduled-items/public`
- Bilhetes: `/api/tickets/mine`, `/api/tickets/sold` (leitura, sem compras)
- Tempo real: `GET /api/posts/engagements/stream`, `GET /api/realtime/status` (admin)

Operações que alteram dados reais **não** são executadas por omissão: criação de
publicações, compras/reservas de bilhetes, pagamentos, eliminações. Gosto e partilha
só com `ALLOW_WRITES=1`; o gosto é retirado na mesma iteração.

## 3. Resultados medidos

### 3.1 Percurso misto (`full-platform.js`, 60 s por patamar)

| VUs | Pedidos/s | Média | p90 | p95 | p99 | Máx | Erros HTTP |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 100 | 66,3 | 643 ms | 1,17 s | 1,38 s | — | 3,14 s | 0,00 % |
| 250 | 71,8 | 2,00 s | 3,36 s | 3,91 s | 6,98 s | 8,19 s | 0,00 % |
| 500 | 69,2 | 4,53 s | 7,67 s | 8,47 s | 15,25 s | 16,99 s | 0,00 % |
| 1 000 | 53,0 | 10,48 s | 16,85 s | 19,71 s | 28,54 s | 36,02 s | 0,00 % |

Leitura: de 100 a 500 VUs a **taxa de pedidos fica presa em ~70 rps** e a latência
cresce quase linearmente (fila). Aos 1 000 VUs até a taxa cai (53 rps): a máquina
passa a gastar tempo em filas e no gerador de carga.

### 3.1b Depois de activar compressão gzip/brotli (mesmo patamar, 100 VUs)

O servidor passou a comprimir respostas JSON (`server/httpCompression.ts`), negociando
`Accept-Encoding` (brotli qualidade 2; gzip nível 1 como alternativa). Medição repetida
com o k6 a enviar `Accept-Encoding: gzip, deflate` (antes não enviava, logo media
respostas sem compressão):

| Cenário | Antes (identidade) | Depois (gzip) |
|---|---|---|
| `full-platform`, 100 VUs, 60 s | 66,3 rps · média 643 ms · p95 1,38 s · 2,58 GB | 59,6 rps · média 747 ms · p95 3,41 s · **1,7 GB** |
| `feed`, 100 VUs, 40 s | 39,8 rps · 1,44 s · p95 3,51 s · 1,95 GB | 36,7 rps · 1,62 s · p95 5,19 s · **1,3 GB** |
| `stories` (bootstrap), 100 VUs, 40 s | 15,4 rps · 3,09 s · p95 5,06 s · 2,20 GB | 13,1 rps · 3,71 s · p95 5,63 s · **1,3 GB** |

Tamanhos por resposta: `/api/posts` 76 124 B → 4 974 B (gzip) / 4 617 B (brotli);
`/api/businesses` 2,99 MB → 2,09 MB; `/api/sync/bootstrap` 3,60 MB → 2,50 MB (gzip)
e **2,12 MB (brotli)**. A mediana do percurso misto caiu de 600 ms para 307 ms.

Leitura honesta: no **mesmo computador**, a compressão custa CPU (o gzip de 3,6 MB leva
~100 ms; o brotli q2 leva ~22 ms) e a taxa baixa ~10 %, com pior cauda nos endpoints
grandes. Em rede real o tráfego cai 30–41 %, que é o ganho que interessa a clientes
móveis; a raiz do problema continua a ser o tamanho dos payloads (§4).

### 3.1c Depois de paginar e aligeirar empresas/bootstrap (100 VUs, 40 s)

`/api/businesses` e `/api/sync/bootstrap` ganharam `limit`/`offset`, `view=summary` e
(no bootstrap) `sections`. Sem parâmetros, o payload mantém-se igual ao anterior,
por isso nenhum consumidor actual quebra.

| Pedido | Bytes |
|---|---:|
| `/api/businesses` (124 empresas, completo) | 2 993 821 |
| `/api/businesses?limit=20` | 35 148 |
| `/api/businesses?limit=20&view=summary` | **12 638** |
| `/api/sync/bootstrap` (completo) | 3 597 626 |
| `/api/sync/bootstrap?sections=businesses&limit=20&view=summary` | **12 898** |
| `/api/sync/bootstrap?sections=stories` | **2 650** |
| `/api/posts` (feed, inalterado) | 76 124 |

`stories.js` (só o bootstrap) a 100 VUs:

| Variante | rps | média | p95 | dados |
|---|---:|---:|---:|---:|
| bootstrap completo | 12,6 | 3,96 s | 5,89 s | 1,3 GB |
| `?sections=businesses&limit=20&view=summary` | **48,7** | **235 ms** | **587 ms** | **4,7 MB** |

Quase 4× a taxa e ~17× menos latência, com 280× menos tráfego. O feed manteve-se:
`feed.js` a 100 VUs dá 36–37 rps com média ~1,6 s, igual à medição anterior à mudança.

### 3.1d Cache curta das respostas comprimidas

Comprimir 3,6 MB custa CPU em cada pedido. O middleware passou a guardar o corpo
comprimido durante 5 s (`HTTP_COMPRESSION_CACHE_TTL_MS`), apenas para respostas `200`
de pedidos **sem** cookie/autorização e sem `Set-Cookie`, com a chave a incluir URL
e `Accept-Language`. Cada resposta comprimida indica `X-Compression-Cache: hit|miss`.

Latência de uma resposta do bootstrap (3,6 MB, gzip, pedidos sequenciais):

| Configuração | Latência |
|---|---:|
| sem compressão (identidade) | 82–111 ms |
| compressão sem cache | 221–252 ms |
| compressão com cache (hit) | **78–103 ms** |

Ou seja, o custo de compressão por pedido (~140 ms) desaparece: o cache serve o
corpo à velocidade da resposta sem compressão.

A/B alternado em `stories.js` (bootstrap completo, 80 VUs, 20 s):

| Configuração | rps | média | p95 |
|---|---:|---:|---:|
| sem cache | 13,7 / 14,4 | 2,57 s / 2,53 s | 5,56 s / 4,17 s |
| com cache | **15,2 / 15,6** | **2,11 s / 2,27 s** | 4,92 s / 5,28 s |

A/B no percurso misto (100 VUs, 45 s) ficou dentro do ruído desta máquina
(46,5–58,7 rps nas duas configurações, sem ordem consistente): com tráfego misto o
limite deixou de ser a compressão e passou a ser o volume de bytes e o próprio k6 a
fazer parse de 2,5 MB por pedido. O ganho é real onde o CPU aperta — muitas ligações
ao mesmo endpoint grande — e maior ainda em rede real.

### 3.2 Por funcionalidade, 100 VUs, 40 s

| Teste | Pedidos/s | Média | p95 | Nota |
|---|---:|---:|---:|---|
| `health-check.js` | **176,1** | 6 ms | 20 ms | carga útil pequena |
| `events.js` | 70,0 | 547 ms | 959 ms | inclui `/api/businesses` (3 MB) |
| `feed.js` | 39,8 | 1,44 s | 3,50 s | inclui `/api/sync/bootstrap` (3,6 MB) |
| `stories.js` (bootstrap) | 15,4 | 3,08 s | 5,05 s | **só** o bootstrap de 3,6 MB |

O mesmo servidor faz 176 rps em respostas pequenas e 15 rps no bootstrap: a
diferença é o **tamanho da resposta**, não a capacidade de rede.

### 3.3 Tamanhos de resposta reais (sem compressão)

| Endpoint | Bytes |
|---|---:|
| `/api/posts` | 76 124 |
| `/api/events` | 591 155 |
| `/api/businesses` | 2 993 821 |
| `/api/sync/bootstrap` | 3 597 475 |

`curl -H 'Accept-Encoding: gzip'` devolve **exactamente os mesmos bytes**: não há
compressão em nenhuma resposta.

### 3.4 Recursos (amostragem de 2 s, `tests/load/monitor.mjs`)

| Métrica | Valor observado |
|---|---|
| CPU do processo Node (soma de núcleos) | média 78 %, p95 **188 %**, pico 229 % |
| RAM do servidor | 159 MB em repouso → **741 MB** de pico → 427 MB após os testes |
| Ligações PostgreSQL (`pg_stat_activity`) | 4–6 no total, no máximo **4 activas** |
| Pool `pg` | `max: 5`, nunca apareceu esgotado nas amostras |
| Canal tempo real (`/api/realtime/status`) | `connected: true`, `lastLatencyMs: 2`, `publishErrors: 0` |

### 3.5 Stress e resistência

- `stress.js` (validação curta: 20→60 rps): 35,0 rps entregues, média 1,17 s, p95 3,43 s,
  **0 % de erros HTTP**, 100 iterações abandonadas (chegadas acima da capacidade).
- `soak.js` (validação curta: 10 VUs, 20 s): média 129 ms, p95 235 ms, 0 % de erros.
  O perfil longo (`SOAK_DURATION=30m`) não foi executado.
- `interactions.js` com `ALLOW_WRITES=1` (1 VU, 5 s): 72 verificações, gosto criado e
  removido com 200, 0 % de erros — o caminho de escrita funciona e não deixa estado.

## 4. Gargalos identificados

1. **Respostas gigantes e não paginadas.** `/api/sync/bootstrap` (3,6 MB) e
   `/api/businesses` (3,0 MB) são reconstruídos e serializados em cada pedido.
   A 15 rps de bootstrap o servidor já gasta mais de dois núcleos.
2. **Payloads ainda grandes apesar da compressão.** O gzip/brotli já está activo
   (`server/httpCompression.ts`), mas 3,6 MB de JSON comprimem apenas para 2,1–2,5 MB
   porque a maior parte do conteúdo é base64 (avatares/logótipos). Reduzir o payload
   na origem continua a ser mais eficaz do que comprimi-lo.
3. **`/api/posts` faz trabalho por pedido.** Duas idas à base de dados
   (`listPostgresBusinesses` + `getAppState('guigui_user_posts')`), junção,
   filtros e ordenação em JavaScript, sem cache.
4. **Latência de login elevada sob carga.** `/api/auth/login` chegou a 2,7 s de média
   com 500 VUs — o hashing de password é CPU-intensivo e competia com a
   serialização das respostas grandes.
5. **Capacidade de ~70 rps por instância** neste hardware, com CPU saturada antes
   do pool PostgreSQL (4 de 5 ligações activas). O pool não é o limite actual;
   subir `DATABASE_POOL_MAX` sem reduzir payload não deve aumentar a taxa.

## 5. Recomendações (por ordem de impacto)

1. Adicionar `compression` (gzip/brotli) às respostas JSON — mudança pequena, ganho
   imediato de banda e de tempo de CPU no cliente.
2. Migrar o cliente para a API paginada (`limit`/`offset`/`view=summary` e
   `sections`), que já existe no servidor: o directório ainda pede as 124 empresas
   completas (3 MB) de uma vez. Falta também paginar `/api/posts` e `/api/events`.
3. Guardar em cache (memória + invalidação por evento) o feed aprovado e as listas
   de empresas/eventos, que mudam muito menos do que são lidas.
4. Servir contadores de engajamento a partir de uma vista agregada, em vez de
   recalcular por pedido.
5. Rever o custo do `bcrypt` no login e considerar limite próprio para `/api/auth/*`.
6. Só depois destes passos faz sentido subir o pool (`DATABASE_POOL_MAX`) e replicar
   instâncias atrás de balanceador.

## 6. Limitações (o que não foi comprovado)

- **2 500, 5 000 e 50 000 VUs não foram testados.** Nesta máquina a saturação
  acontece aos ~70 rps, muito antes disso; declarar capacidade para milhares de
  acessos sem testes executados seria incorrecto.
- k6 corre **no mesmo computador** do servidor: CPU/RAM medidos incluem a
  competição do gerador de carga e os números são indicativos, não absolutos.
- Não há Redis nem WebSocket no projecto; `websocket.js` mede o handshake SSE.
- `/api/metrics` expõe apenas contadores agregados (sem estado do pool), por isso
  as ligações PostgreSQL foram contadas via `pg_stat_activity` pelo monitor.
- Testes feitos contra o ambiente local, com contas de demonstração; nada foi
  executado contra produção.
- Não foram testados fluxos de escrita (publicar, comprar bilhete, pagar) por
  desenho, para não alterar dados reais.

## 7. Como reproduzir

```bash
node tests/load/monitor.mjs 24400 2000          # amostras em results/monitor.jsonl
k6 run -e VUS=100 -e DURATION=60 --summary-export tests/load/results/full-100.json tests/load/full-platform.js
k6 run -e VUS=250 ... ; VUS=500 ... ; VUS=1000 ...
k6 run -e SOAK_VUS=50 -e SOAK_DURATION=30m tests/load/soak.js
k6 run -e BASE_RPS=50 -e TARGET_RPS=400 tests/load/stress.js
```
