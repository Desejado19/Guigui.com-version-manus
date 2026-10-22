# Especificação: observabilidade HTTP em `platform-foundation`

**Estado:** aprovada pelo utilizador
**Data:** 2026-10-22
**Escopo:** extração incremental da observabilidade HTTP para o módulo `platform-foundation`
**Compatibilidade:** preservar endpoints, formatos, permissões, persistência e semântica atuais

## Objetivo

Isolar a recolha, persistência e exposição das métricas HTTP atuais numa fronteira de `platform-foundation`, reduzindo o código técnico ligado diretamente a `server.ts` sem adicionar dependências nem alterar os consumidores.

A fatia cobre o acumulador de métricas HTTP em memória, o middleware HTTP de instrumentação, as consultas ao armazenamento PostgreSQL e as rotas existentes de métricas em JSON e Prometheus. Não cobre outros serviços que também possam ser considerados observabilidade em sentido amplo.

## Contexto atual

- `server.ts` mantém o acumulador em memória (`total`, erros e métricas por rota), mede durações no middleware e executa gravações PostgreSQL assíncronas ao concluir cada resposta.
- O middleware também define `X-Request-Id` e regista respostas 4xx/5xx ou com duração de pelo menos 1.000 ms.
- `server/observabilityService.ts` grava e agrega as métricas na tabela `request_metrics`.
- `server/prometheusService.ts` formata as métricas Prometheus e consulta o agregado persistido.
- `GET /api/metrics` exige o papel `admin` e devolve o resumo JSON operacional.
- `GET /metrics` não exige autenticação e devolve métricas em texto Prometheus.
- A primeira fatia de `platform-foundation` já extraiu `GET /api/health`; esta proposta não altera esse módulo.

## Abordagem

Extrair a observabilidade HTTP como submódulo de `server/modules/platform-foundation/observability/`. `server.ts` continua a ser o composition root: instancia o acumulador e as dependências, instala o middleware e monta os handlers. Os módulos não acedem ao singleton PostgreSQL; o adaptador recebe as dependências de persistência pela composição.

Estrutura indicativa:

```text
server/modules/platform-foundation/observability/
  domain/
    httpMetrics.ts
  application/
    observabilityService.ts
  adapters/
    postgresObservabilityRepository.ts
  http/
    observabilityMiddleware.ts
    observabilityHandlers.ts
```

Responsabilidades:

- **`domain/httpMetrics.ts`**: acumular contagens por processo e disponibilizar snapshot imutável de total, erros e dados por rota, sem importar Express, PostgreSQL ou detalhes Prometheus.
- **`application/observabilityService.ts`**: fornecer o resumo JSON e coordenar a consulta agregada persistida através de um contrato explícito de repositório.
- **`adapters/postgresObservabilityRepository.ts`**: implementar os comandos e consultas atuais à tabela `request_metrics`.
- **`http/observabilityMiddleware.ts`**: medir cada resposta concluída, atualizar o acumulador, solicitar a persistência assíncrona e preservar o comportamento de request ID e logging existente.
- **`http/observabilityHandlers.ts`**: expor o resumo JSON e o documento Prometheus usando o estado e repositório injetados.

Manter a estrutura enxuta se a implementação mostrar que uma separação indicada não ganha um consumidor ou responsabilidade distinta. Não adicionar abstrações genéricas de métricas.

## Contratos e comportamento preservado

### Instrumentação HTTP

Para cada resposta concluída, o middleware:

1. calcula a duração em milissegundos e arredonda como atualmente;
2. usa `req.route?.path || req.path` como chave de rota;
3. incrementa o total do processo e a contagem da rota;
4. considera erro em memória apenas resposta com status `>= 500`;
5. atualiza duração acumulada por rota para o cálculo de `averageMs`;
6. agenda a persistência PostgreSQL sem atrasar a resposta;
7. define `X-Request-Id` e regista evento JSON para respostas com status `>= 400` ou duração `>= 1000 ms`.

O helper `requestIdFrom` é também usado por outras rotas. Não o remover nem alterar a sua semântica como parte desta fatia. O middleware deve consumir a resolução de request ID como dependência ou reutilizar o helper sem criar uma segunda implementação concorrente.

Falhas ao persistir a métrica continuam a ser reportadas com o evento estruturado `observability_persist_failed`, incluindo o request ID e uma mensagem de erro segura. A falha de persistência não desfaz a resposta enviada, não altera as métricas em memória e não é convertida numa resposta de sucesso fictícia do endpoint de leitura.

### Persistência

- Sem PostgreSQL configurado, a escrita não persiste no banco e a consulta agregada devolve `null`, como atualmente.
- Com PostgreSQL, preservar as operações atuais de upsert e agregação diária da tabela `request_metrics`.
- A coluna `error_count` persistida considera respostas com status `>= 400`; esta semântica difere intencionalmente da contagem em memória, que considera somente `>= 500`.
- Preservar a limitação atual do valor de rota persistido a 255 caracteres.
- Não alterar schema, índices, migrações, política de retenção ou ciclo de vida dos dados.
- Erros na consulta de leitura devem continuar visíveis ao handler/middleware de erro Express; não substituir a falha por um resumo vazio ou por `null`.

### API administrativa JSON

`GET /api/metrics` mantém a autorização `requireRole('admin')`, o status e o formato atual:

```ts
{
  totalRequests: number;
  errors: number;
  routes: Array<{
    route: string;
    count: number;
    errors: number;
    averageMs: number;
  }>;
  database: {
    metricsDate: string;
    requests: number;
    errors: number;
  } | null;
}
```

`errors` em memória conta 5xx; `routes[].errors` segue o contador atual, também para 5xx. `database.errors` conta respostas 4xx e 5xx conforme a persistência atual.

### API Prometheus

`GET /metrics` permanece sem autenticação, com resposta `text/plain`. Preservar os nomes, tipos, conteúdo e escaping das métricas atuais:

- `guigui_http_requests_total` (counter)
- `guigui_http_errors_total` (counter)
- `guigui_http_route_requests_total` (counter com label `route`)
- `guigui_persistent_requests_total` (gauge, quando houver agregado PostgreSQL)
- `guigui_persistent_errors_total` (gauge, quando houver agregado PostgreSQL)

O endpoint deve continuar a responder com newline final. Não alterar o acesso público nem os labels, agregações ou nomes como parte desta refatoração.

## Testes e critérios de conclusão

1. **Domínio, determinístico:** cobrir total, contagem por rota, distinção 5xx versus 4xx para erros em memória e cálculo de duração média.
2. **Persistência, adaptador:** verificar SQL parametrizado, upsert e agregação diária; verificar comportamento sem pool configurado e fila vazia, usando os padrões de teste PostgreSQL já existentes sem base externa.
3. **Middleware HTTP:** verificar que a métrica só é observada ao concluir a resposta, que request ID e logs existentes se mantêm, e que uma falha assíncrona de persistência é registada sem alterar a resposta original.
4. **Rotas:** verificar JSON de admin, resposta `401`/`403` sem papel de admin, Prometheus `text/plain` sem autenticação e nomes/tipos/valores esperados.
5. **Compatibilidade:** manter os testes já existentes e executar as auditorias/Playwright relevantes para saúde e rotas públicas.
6. **Qualidade geral:** `npm run check`, `npm run build` e `npm run test:unit` passam sem remover, ignorar ou enfraquecer testes existentes. O teste E2E relevante passa contra o servidor local.

Os testes devem fixar valores derivados de fixtures literais e observar efeitos reais; mocks limitam-se a fronteiras externas, como falha de consulta ao PostgreSQL. Nenhum teste depende de uma base de dados de produção ou de credenciais externas.

## Fora de escopo

- Alterar a acessibilidade pública de `/metrics` ou as permissões de `/api/metrics`.
- Alterar semântica de erros, labels, cardinalidade, route normalization, intervalos, nomes/tipos Prometheus ou formato JSON.
- Adicionar biblioteca ou agente externo de telemetria.
- Reorganizar `requestIdFrom` para todos os endpoints, logs não pertencentes ao middleware, analytics de produto, rate limit, backup ou health check.
- Mudar schema, migrações, retenção de métricas ou configuração de banco.
- Refatorar outros contextos de negócio.

## Decomposição e execução

Esta especificação contém uma única fatia executável: a extração da observabilidade HTTP. O plano subsequente deverá ordenar testes e migração em passos RED→GREEN, alterar apenas os ficheiros relacionados com os módulos listados e validar o contrato antes de remover a implementação anterior.

O workspace não contém metadados Git. A especificação não foi commitada; nenhum repositório será inicializado sem autorização explícita.

## Revisão de consistência

- Os endpoints, permissões e formatos referidos correspondem à implementação atual observada.
- A diferença entre erros em memória (5xx) e erros persistidos (4xx/5xx) está documentada e testável.
- O acesso público atual a `/metrics` é preservado, mesmo sendo distinto da rota administrativa.
- Nenhuma alteração de schema, fornecedor, frontend ou domínio comercial é implicada.
- A iniciativa altera apenas a localização/propriedade da lógica e mantém a execução no processo Express existente.
