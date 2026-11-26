# Especificação: migração PostgreSQL — diretório, catálogo e eventos

**Estado:** desenho da primeira fatia aprovado em 2026-10-23; revisão do documento pendente
**Data:** 2026-10-23
**Escopo:** primeira fatia da migração incremental dos fluxos JSON para PostgreSQL
**Compatibilidade:** manter o modo local sem PostgreSQL durante a migração; PostgreSQL é a única fonte quando configurado

## Objetivo

Fazer com que a taxonomia pública, as empresas e os eventos apresentados pelo site sejam lidos do PostgreSQL quando `DATABASE_URL` estiver configurada. Esta é a primeira etapa de uma migração incremental por domínio; a carga transversal de 1.000 registos sintéticos só será feita depois das restantes fatias e numa base local descartável.

## Contexto observado

- A migração `001_initial_schema.sql` já define `categories`, `companies` e `events`; `008_event_snapshot_data.sql` acrescenta o JSONB de dados de evento.
- `categories` representa hierarquia por `parent_id`, mas `seed-categories-db.ts` só insere cinco grupos e 13 categorias principais. O frontend contém cinco grupos, 16 categorias principais, subcategorias, ícones e outras propriedades.
- `GET /api/businesses` e `GET /api/events` já consultam serviços PostgreSQL quando a base está configurada. Sem PostgreSQL, os serviços preservam caminhos locais.
- O frontend ainda mistura empresas recebidas da API com `INITIAL_BUSINESSES`; os eventos são carregados por estado persistido no navegador e também são sincronizados para `app_state`. Isso deixa duas fontes de verdade e pode manter exemplos locais numa sessão ligada ao PostgreSQL.
- A taxonomia é definida em `src/data/initialData.ts`; componentes de listagem e perfil ainda importam categorias diretamente desse ficheiro.
- Os importadores de snapshots e a seed atual de demonstração não serão usados como fonte de dados sintéticos.
- A instância PostgreSQL 18 local foi escolhida, mas ainda não existe uma base descartável confirmada. Nenhuma migração, criação de base ou escrita foi executada nesta etapa.

## Abordagens consideradas

1. **Hierarquia relacional de categorias — escolhida.** Reutiliza `categories`, `companies` e `events`, preserva as relações e permite que a interface consulte os dados pela API existente.
2. **Catálogo completo em `app_state` JSONB.** Exigiria menos alterações de esquema, mas duplicaria o modelo relacional existente e dificultaria validar hierarquia e referências.
3. **Categorias estáticas com empresas/eventos relacionais.** É a alteração mais pequena, mas não cumpre o objetivo de tornar o catálogo fonte de dados PostgreSQL.

## Escopo

### Incluído nesta fatia

- Tornar grupos, categorias principais e subcategorias da taxonomia acessíveis a partir de PostgreSQL, incluindo o ícone necessário pela interface.
- Completar e tornar idempotente a seed de referência da taxonomia, sem remover registos não pertencentes à seed.
- Expor uma leitura pública tipada da taxonomia.
- Fazer a interface consumir a taxonomia, empresas e eventos da API quando PostgreSQL estiver configurado, sem mesclar exemplos estáticos ou estado antigo do navegador.
- Manter o comportamento local existente quando PostgreSQL não estiver configurado.

### Excluído desta fatia

- Preços por grupo, planos e outras regras comerciais: pertencem à fatia posterior de monetização.
- Bilhetes, pedidos, pagamentos, sessões/convites, avaliações, mensagens, notificações, moderação e operações.
- Importação ou conversão de quaisquer dados existentes, snapshots ou ficheiros locais.
- A seed transversal de 1.000 registos; esta fatia fornece apenas dados de referência de categorias e testes controlados.
- Remoção global dos caminhos JSON. Eles só serão retirados após cada domínio ser migrado e validado.

## Arquitetura e contratos

### Modelo de categorias

Usar a hierarquia existente de `categories`: grupos sem pai, categorias principais filhas de um grupo e subcategorias filhas de uma categoria principal. Acrescentar `sort_order` para uma ordenação estável e metadados JSONB para propriedades de apresentação como `iconName`; não armazenar ali preços de subscrição nesta etapa. A ordem da árvore não pode depender da ordem física das linhas.

Extrair as definições partilhadas da taxonomia para um módulo tipado reutilizável pela interface e pela seed. `seed-categories-db.ts` deve usar essa fonte, cobrir todas as categorias e subcategorias definidas pelo produto e aplicar upserts numa transação. Não deve oferecer opção `--clean` nem apagar linhas.

### API

Adicionar `GET /api/categories`, sem autenticação, com o contrato:

```ts
type CategoryGroupSummary = {
  id: string;
  name: string;
  description: string;
};

type CategoryCatalogResponse = {
  groups: CategoryGroupSummary[];
  categories: BusinessCategory[];
};
```

`BusinessCategory` mantém os campos usados pelo frontend: `id`, `name`, `iconName`, `groupId` e `subcategories`. A resposta é sempre o mesmo objeto; uma taxonomia vazia no PostgreSQL configurado resulta em arrays vazios. Sem PostgreSQL configurado, a API pode servir a taxonomia local existente para preservar o modo de desenvolvimento.

Manter os formatos atuais de `GET /api/businesses` e `GET /api/events`. Os endpoints de escrita existentes continuam autenticados e persistem nas tabelas relacionais. Em modo PostgreSQL não se deve duplicar empresas ou eventos em `app_state`.

Falhas de leitura do PostgreSQL devem produzir resposta de erro explícita no padrão atual da API, com código estável `CATEGORY_CATALOG_LOAD_FAILED`; não devem transformar falhas em listas vazias nem em sucesso com dados locais. A leitura pública de categorias é limitada e ordenada; paginação não se aplica à árvore de referência desta fatia.

### Interface e seleção da fonte

- A interface consulta o estado de configuração do banco pelo health endpoint. Se `database.configured` for verdadeiro, categorias, empresas e eventos vêm das APIs PostgreSQL.
- Em modo PostgreSQL, substituir o estado inicial/local pelo resultado remoto. Uma resposta vazia é um estado vazio real; erro de rede ou consulta apresenta erro, sem reintroduzir `INITIAL_BUSINESSES`, categorias estáticas ou eventos antigos do `localStorage`.
- Quando PostgreSQL estiver desativado, manter o modo local atual até as demais fatias serem migradas.
- A taxonomia deve ser disponibilizada aos consumidores da interface por uma fronteira tipada partilhada, evitando imports diretos de listas estáticas em componentes de catálogo, cartão e perfil.
- O estado de preço de subscrição permanece fora desta fatia e será migrado junto da monetização.

## Segurança e isolamento dos dados

- Aplicar migrações e seed explicitamente, nunca automaticamente durante o arranque do site.
- Antes de qualquer escrita, confirmar que a URL aponta para uma nova base vazia na instância PostgreSQL 18 local; não usar a base de desenvolvimento existente, bases partilhadas ou produção.
- Não ler nem importar `.env`, snapshots ou dados existentes. Não usar os ficheiros `.tmp-mig.txt` nem `Guigui.com-sistema-completo.zip`.
- A seed deve ser idempotente, limitada a IDs próprios de referência e incapaz de apagar dados alheios.
- Os dados do seed transversal posterior serão gerados sinteticamente e terão identificadores próprios; não incluir credenciais utilizáveis ou dados pessoais reais.

## Critérios de aceitação e testes

1. A API de categorias devolve grupos, categorias e subcategorias completos, tipados e numa ordem determinística.
2. Repetir a seed de categorias não cria duplicados nem remove ou altera linhas sem IDs de referência próprios.
3. Com PostgreSQL configurado e vazio, a interface não mostra empresas/eventos de `initialData.ts` nem dados antigos de `localStorage`.
4. Com PostgreSQL configurado e povoado por fixtures sintéticas, a interface mostra empresas/eventos da base, e categorias/filtros/perfis usam a taxonomia da API.
5. Uma falha de consulta com PostgreSQL configurado é apresentada como erro, sem fallback silencioso.
6. Sem PostgreSQL, os testes de regressão confirmam que o modo local atual continua funcional.
7. Os testes incluem unidade para mapeamento da árvore, testes de API para estados vazio/povoado/erro, integração PostgreSQL para a seed idempotente e E2E da listagem, filtros e persistência de eventos após recarregar.
8. `npm run check`, `npm run test:unit` e `npm run build` passam; testes de integração PostgreSQL só são executados contra a base descartável validada.

## Roadmap das fatias seguintes

1. **Diretório, catálogo e eventos** — esta especificação.
2. **Identidade, contas e sessões** — rever os fluxos restantes de convites, recuperação e estado de conta que ainda dependem de JSON.
3. **Bilhetes, pedidos e pagamentos** — alinhar reservas, ciclo de vida, reembolsos e leitura no site.
4. **Avaliações, comunicação e moderação** — tornar PostgreSQL fonte de verdade para conteúdo, mensagens, suporte e notificações.
5. **Monetização e operações** — planos, preços, promoções, auditoria, analytics, agendamento e restantes estados persistidos.
6. **Seed sintético transversal e verificação final** — gerar 1.000 registos relacionados na base isolada, validar contagens por domínio e confirmar a apresentação no site.

Cada fatia posterior terá especificação e aprovação próprias; este documento não autoriza uma migração “big bang”.

## Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Dados estáticos continuam a ser mesclados em modo PostgreSQL | A interface parece povoada apesar de a base estar vazia | Teste E2E com base vazia e IDs estáticos conhecidos |
| Árvore da seed diverge da taxonomia do frontend | Filtros e formulários apresentam categorias incompletas | Uma definição tipada partilhada entre interface e seed |
| Erro de banco é tratado como ausência de dados | Falha operacional fica escondida | Separar resposta vazia de erro e testar ambos |
| Seed executada na base errada | Dados de teste contaminam outra base | Validar alvo descartável antes de migrações ou seed; não executar nesta etapa |
| Migração desta fatia se expande para monetização ou outros domínios | Aumenta risco e dificulta revisão | Manter preços e os outros domínios fora do escopo, com fatias próprias |
