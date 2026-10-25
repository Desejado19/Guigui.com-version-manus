# Especificação: operações duráveis de `platform-foundation`

**Estado:** rascunho para revisão do utilizador
**Data:** 2026-10-25
**Contexto:** `platform-foundation` dentro do monólito Guigui.com
**Limite:** esta especificação não autoriza implementação, execução de migrations em banco real, importação de dados ou alterações no Render.

## Objetivo

Completar a persistência operacional da fundação usando PostgreSQL para jobs assíncronos, rate limits partilhados e telemetria aprovada, sem introduzir microserviços nem alterar os contratos de negócio dos contextos consumidores.

O processo HTTP e o worker são processos distintos do mesmo monólito. PostgreSQL continua obrigatório em produção; memória local é permitida apenas em desenvolvimento/testes. Migrations são explícitas e nunca executadas no arranque normal.

## Entendimento aprovado

- O worker será um processo contínuo separado do processo HTTP.
- Esta fatia implementa a infraestrutura da fila, não handlers de negócio. Não há handlers vazios que marquem jobs como concluídos; cada contexto regista o seu handler quando for implementado.
- `backup` pode existir como tipo de job, mas o estado da fila não comprova sucesso de backup. A Tarefa 9 é dona do resultado e só pode declarar `completed` após verificar o artefacto cifrado.
- Jobs concluídos e jobs em dead-letter são retidos por 30 dias após entrarem no estado terminal. Jobs pendentes/em execução não são expurgados automaticamente.
- Eventos brutos de produto são retidos por 365 dias.
- Métricas HTTP agregadas não têm expurgo automático, mas apenas guardam templates de rota normalizados. Caminhos sem template usam uma categoria genérica; caminhos literais, IDs e query strings não são persistidos.
- Buckets de rate limit expiram no fim da janela correspondente e são removidos por limpeza periódica.
- `/api/health` mantém o contrato existente e não passa a depender da disponibilidade do worker.
- Não executar mudanças em Render nem aceder a bases de dados reais nesta fatia.

## Contexto observado

O schema inicial já contém `async_jobs`, `rate_limit_buckets`, `product_events` e `request_metrics`. Os serviços correspondentes ainda estão em `server/` e têm diferentes comportamentos sem banco: a fila usa memória; rate limit retorna `null`; analytics não persiste. A verificação de produção da Tarefa 1 garante PostgreSQL no arranque da API, mas o comando `npm run worker` atual executa um único job e termina, e os handlers declarados são stubs.

Não foram encontrados consumidores de `enqueueJob`, `consumeDistributedRateLimit` ou `persistProductEvent` fora dos próprios serviços e testes. A infraestrutura será preparada sem ativar ou inventar fluxos de negócio. O worker permanece ocioso enquanto não houver handlers registados.

O middleware de observabilidade usa atualmente `request.route?.path || request.path`. Como `request.path` pode conter identificadores dinâmicos, a persistência permanente de métricas requer normalização antes de gravar.

## Abordagem escolhida

1. **Worker contínuo separado, dentro do mesmo monólito — escolhida.** Usa o contrato de fila PostgreSQL, permite múltiplas instâncias e mantém o processo HTTP isolado da execução de jobs.
2. **Worker embutido no processo HTTP.** Não escolhido: acopla consumo de jobs à disponibilidade e ao ciclo de vida das requisições.
3. **Execução one-shot via scheduler externo.** Não escolhida: não corresponde ao ciclo de vida aprovado e exigiria orquestração fora do escopo.

## Arquitetura e ownership

- `platform-foundation` é dono do ciclo de vida da fila, leases, tentativas, rate-limit buckets, retenção operacional e persistência de telemetria.
- Cada contexto de negócio é dono do handler, do payload e das regras do seu tipo de job. O worker apenas despacha por um registry explícito; não lê tabelas privadas de outros contextos.
- `scripts/worker.ts` torna-se o entrypoint do processo contínuo; a API continua a iniciar pelo entrypoint existente.
- Os serviços atuais em `server/` podem permanecer como fachadas compatíveis enquanto os adaptadores são extraídos para `server/modules/platform-foundation/`.
- As tabelas existentes permanecem PostgreSQL-owned. Alterações de schema são aditivas e passam por `npm run db:migrate` com alvo explícito.
- O código não usa serviços externos nem adiciona dependências nesta fatia.

## Jobs assíncronos

### Claim, leases e execução

- Cada worker trata um job de cada vez. Várias instâncias concorrem de forma segura com `FOR UPDATE SKIP LOCKED`.
- O worker verifica PostgreSQL antes de iniciar. Sem banco em produção, termina com erro explícito; não consome a fila em memória.
- Um worker ocioso aguarda 1 segundo antes de procurar novamente.
- O claim cria um lease de 5 minutos; o worker renova o lease a cada minuto durante a execução.
- Jobs com lease expirado ficam elegíveis para novo claim. O limite existente de cinco tentativas continua válido, incluindo reclaim após crash.
- Em `SIGTERM`/`SIGINT`, o worker para de reivindicar jobs, termina o job ativo e então fecha o pool; uma terminação forçada deixa o lease expirar para permitir retry.
- Falhas de ligação no loop usam espera exponencial limitada a 30 segundos; nenhuma tentativa confirma o job.
- Jobs não são reivindicados sem handler registado. Não há sucesso fictício para tipos ainda não implementados.
- O handler marca `completed` apenas depois de concluir a operação própria. Uma falha incrementa as tentativas e usa o backoff exponencial existente; esgotadas as tentativas, o job passa a `dead_letter`.
- Erros guardados em `last_error` são limitados e sanitizados: nunca incluem payloads, credenciais, tokens ou URLs de conexão.

### Tipos e backup

`notification`, `webhook`, `export` e `reconciliation` continuam disponíveis como tipos de infraestrutura, sem handlers adicionados por esta fatia. `backup` não é habilitado por um handler vazio. Na futura Tarefa 9, a execução de backup terá registo próprio e o resultado `completed` só será publicado após cifragem e verificação do artefacto. O estado `completed` de um job genérico nunca substitui esse resultado.

### Retenção

- `completed_at` determina os 30 dias de retenção de jobs concluídos.
- Uma coluna de data terminal para dead-letter determina os 30 dias de retenção de falhas esgotadas.
- Uma limpeza horária remove somente estados terminais vencidos; nunca remove `pending` ou `processing`.
- O timestamp usado para expurgo é o momento de entrada no estado terminal, não `created_at`.

## Rate limits

- A API existente de consumo continua a ser atómica no PostgreSQL e mantém o resultado `boolean | null` para compatibilidade local.
- Em produção, a ausência de banco é bloqueada pelo preflight; indisponibilidade durante uma operação propaga erro explícito, sem fallback em memória.
- Cada bucket guarda o instante de expiração associado à sua janela atual. Uma janela expirada reinicia a contagem e a expiração.
- A limpeza horária remove buckets expirados, no máximo uma hora após o fim da janela. A limpeza não é executada por cada requisição.
- O serviço não regista a chave do bucket nem inclui valores de chave em mensagens de erro.

## Telemetria e observabilidade

### Eventos de produto

- A lista allowlist atual de eventos continua explícita; eventos desconhecidos não são persistidos.
- `user_id` pode identificar uma conta autenticada e `session_id` é apenas um identificador analítico não secreto — nunca um token de autenticação.
- O `context` aceita somente dimensões não sensíveis definidas por evento; contactos, credenciais, dados de pagamento e payloads livres não são persistidos.
- Eventos são removidos na limpeza horária após 365 dias, com base em `occurred_at`.
- A falha de persistência é visível em log sanitizado. O caminho de analytics não transforma falha de PostgreSQL em confirmação de persistência.

### Métricas HTTP

- `request_metrics` continua a conter agregados diários por rota: contagens, erros e duração acumulada; não contém utilizador, sessão, corpo ou query string.
- Só um template estável de rota Express é persistido. Sem template, usar `unmatched`; nunca persistir `request.path` literal.
- A normalização é aplicada na fronteira de persistência; o registry em processo conserva o comportamento atual nesta fatia.
- Os agregados não são expurgados automaticamente, conforme aprovado. A normalização impede IDs e valores variáveis de se tornarem dimensões permanentes.
- Falha de gravação da telemetria HTTP é registada de forma sanitizada e não altera a resposta já enviada ao cliente; o health/readiness continua a refletir a disponibilidade real do PostgreSQL.

## Health, readiness e falhas

- O contrato `/api/health` implementado na Tarefa 1 permanece aditivo e independente da disponibilidade do worker.
- PostgreSQL indisponível mantém a API em readiness degradada/HTTP 503; nenhum serviço de produção recorre a JSON ou memória como fonte alternativa.
- O worker valida PostgreSQL antes do loop. Durante indisponibilidade, não confirma jobs; regista o erro sanitizado e tenta recuperar com espera limitada.
- O estado operacional do worker é observado pelo processo supervisor e pelos logs; esta fatia não adiciona heartbeat nem torna a API dependente do worker.
- Falhas de claim, heartbeat, conclusão, retry ou limpeza não são convertidas em sucesso.
- Migrations são executadas somente por CLI explícito da Tarefa 2, nunca pelo processo HTTP nem pelo worker.

## Testes e verificação

1. Unitários para claim concorrente, heartbeat/lease, reclaim após crash, limite de tentativas, dead-letter, dispatch apenas para handlers registados e ausência de conclusão fictícia.
2. Testes de retenção para jobs terminais, eventos de produto e buckets expirados; provar que jobs pendentes/em execução e métricas HTTP não são removidos.
3. Testes de normalização: rota com template persiste o template; rota sem template não persiste caminho literal nem query string.
4. Testes de falha: ausência/queda de PostgreSQL não seleciona memória em produção e não confirma operação; erros persistidos/logados não expõem payload, credenciais ou URLs.
5. Integração PostgreSQL 18 com `TEST_DATABASE_URL` explicitamente descartável; validar persistência após desconexão/reconexão e reinício do worker.
6. `npm run lint`, testes unitários e `npm run build`.
7. Sem execução contra banco externo, sem migrations automáticas, sem deploy e sem alterações no Render.

## Critérios de aceitação

- A API conserva o contrato de health/readiness da Tarefa 1, independente do worker.
- O worker é contínuo e separado, requer PostgreSQL em produção e não perde jobs sem handler.
- Jobs em execução são recuperáveis após lease expirar; tentativas esgotadas resultam em dead-letter, nunca sucesso.
- Os jobs terminais e eventos de produto respeitam as retenções aprovadas; buckets expiram pela janela; métricas HTTP indefinidas contêm apenas templates normalizados.
- Backup só é declarado concluído pela futura integração proprietária depois da verificação do artefacto cifrado.
- Nenhum comportamento usa memória/JSON como fallback de produção.
- Monólito, dependências do `CAPABILITY-MAP.md` e APIs atuais permanecem compatíveis.

## Fora de escopo

- Implementar handlers de negócio, fornecedores de webhook/notificação, exportações ou backups.
- Criar/alterar tabelas de histórico de backup — ownership da Tarefa 9.
- Iniciar jobs ou importar dados reais, executar migrations em produção, operar serviços externos ou alterar Render.
- Fazer os endpoints de negócio passarem a chamar rate limit ou analytics onde atualmente não chamam; essa integração requer contrato e teste próprios.
- Redesenhar o health da API para depender do processo worker.
