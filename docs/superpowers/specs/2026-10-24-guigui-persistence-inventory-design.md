# Especificação: inventário de persistência e preparação da migração PostgreSQL

**Estado:** desenho aprovado em conversa; revisão do documento pendente  
**Data:** 2026-10-24  
**Escopo deste subprojeto:** mapear os dados persistentes e as fontes de verdade do Guigui.com para preparar a migração integral por contexto  
**Iniciativa relacionada:** tornar o PostgreSQL a fonte de verdade de todos os dados persistentes próprios das funcionalidades do site

## Objetivo

Estabelecer, com evidências no código e no schema, quais dados persistentes cada funcionalidade utiliza, onde são atualmente lidos e gravados, quais já usam PostgreSQL e quais ainda dependem de memória, armazenamento do navegador, ficheiros ou serviços externos. O resultado será uma matriz de lacunas e uma sequência de fatias de migração, cada uma com especificação, plano e validação próprios.

Este inventário é o primeiro subprojeto; não declara que a migração completa está concluída e não altera a persistência do runtime.

## Decisões aprovadas

- O destino é PostgreSQL para todos os dados persistentes próprios das funcionalidades do site.
- A migração será incremental, por contexto de domínio, e respeitará o mapa de capacidades existente.
- Em produção, a aplicação exige PostgreSQL configurado e conectado; indisponibilidade deve ser explícita e não pode ser ocultada por dados locais.
- O modo local pode continuar disponível exclusivamente para desenvolvimento e testes.
- Código da aplicação, HTML, CSS, JavaScript, imagens estáticas e outros artefactos do deploy não são dados de negócio e não serão movidos para tabelas.
- Para ficheiros enviados pelos utilizadores, o PostgreSQL poderá guardar metadados, propriedade e referências; o conteúdo binário poderá permanecer num armazenamento próprio de ficheiros.
- Nenhuma migration será executada automaticamente no arranque.
- Nenhuma importação, alteração ou eliminação será feita numa base existente sem identificação do alvo, backup e confirmação explícita do ambiente correto.

## Contextos e ordem de migração

O inventário cobre os sete contextos do `CAPABILITY-MAP.md`, nesta ordem:

1. `platform-foundation` — configuração, estado operacional, saúde e contratos técnicos.
2. `identity-access` — contas, credenciais, sessões e autorização.
3. `business-discovery` — empresas, categorias, conteúdo, diretório, feed, ofertas e avaliações.
4. `payments-monetization` — pagamentos, subscrições, catálogo comercial, comissões, reconciliação e reembolsos.
5. `events-ticketing` — eventos, inventário, reservas, pedidos, bilhetes e validação de acesso.
6. `communication-support` — conversas, mensagens, suporte e notificações.
7. `governance-operations` — moderação, denúncias, auditoria e operações administrativas.

As dependências e a ordem refletem o mapa modular existente; não autorizam acesso direto às tabelas de outro contexto.

## Trabalho incluído

Para cada fluxo de dados encontrado:

1. Identificar as entidades e campos persistentes que a funcionalidade consome ou altera.
2. Localizar os caminhos de leitura e escrita: API, serviços, repositórios, estado React, armazenamento do navegador, ficheiros e integrações externas.
3. Relacionar entidades com tabelas e migrations existentes, assinalando lacunas de schema, endpoints, serviços ou testes.
4. Classificar o dado como persistente de negócio, operacional/auditável, temporário, derivado, configuração de ambiente, media binária ou artefacto estático.
5. Registar se o dado tem uma única fonte de verdade ou se existe duplicação/dual-write.
6. Para dados persistentes sem destino PostgreSQL, recomendar um domínio responsável e uma migração incremental com validação, backup e reversão.
7. Produzir uma matriz de cobertura e uma lista ordenada de especificações a criar para as fatias de implementação seguintes.

O inventário deve seguir os caminhos de utilizador até ao banco e não pode inferir cobertura a partir da mera existência de uma tabela ou interface de serviço.

## Fora de escopo

- Alterar código de runtime, interfaces ou comportamento de produção.
- Executar migrations, seed, importação, backup que leia dados pessoais ou consultas a bases reais.
- Inspecionar ou revelar credenciais, ficheiros `.env`, snapshots ou dados de clientes.
- Migrar conteúdo binário de imagens/documentos para PostgreSQL.
- Reescrever o backend como microserviços ou criar uma camada genérica de persistência antes de mapear os requisitos reais.
- Incluir estado temporário/derivado por omissão, como caches e estado transitório de UI; a classificação e justificação ficam registadas no inventário.

## Artefacto do inventário

A matriz de cobertura deve conter, para cada entidade/fluxo:

| Campo | Significado |
|---|---|
| Contexto e funcionalidade | Proprietário do dado e caminho de utilizador/API |
| Entidade e campos | Dados persistentes efetivamente consumidos ou atualizados |
| Fonte atual | PostgreSQL, navegador, memória, ficheiro ou serviço externo |
| Fonte de verdade desejada | PostgreSQL ou sistema externo proprietário |
| Cobertura no schema | Tabelas, constraints e migrations existentes |
| Cobertura de leitura/escrita | Serviços/endpoints reais que usam a persistência |
| Lacunas e risco | Divergência, perda, duplicação, segurança ou compatibilidade |
| Próxima fatia | Especificação de domínio necessária e dependências |
| Validação | Testes, reconciliação de contagens e critério de cutover |

Não se guardarão valores de dados pessoais nem segredos na matriz; somente referências de código/schema e descrições estruturais.

## Requisitos de migração derivados

As especificações posteriores por contexto devem:

- Definir schema e ownership dos dados.
- Fazer leitura e escrita através dos serviços do contexto, sem consumidores acederem diretamente às tabelas de outro domínio.
- Garantir persistência durável no PostgreSQL em produção e comportamento de erro explícito quando o banco não estiver disponível.
- Manter o modo local limitado a desenvolvimento/testes.
- Definir migração dos dados existentes sem perda, com importação repetível, backup, reconciliação e estratégia de reversão.
- Cobrir sucesso, vazio, indisponibilidade e falhas parciais em testes adequados.
- Só efetuar cutover depois de confirmar ambiente, consistência e evidência de validação.

## Critérios de aceitação deste subprojeto

1. Todos os sete contextos têm inventário com entidades persistentes identificadas ou uma justificação explícita para não persistir estado próprio.
2. Cada fluxo persistente tem a fonte atual, fonte de verdade desejada e cobertura real de leitura/escrita documentadas.
3. A matriz distingue dados duráveis, temporários, derivados, configuração, media binária e recursos estáticos.
4. Lacunas de schema, API, persistência, UI, migração e testes estão associadas ao contexto proprietário.
5. A sequência de fatias seguintes é ordenada por dependência e inclui critérios verificáveis de conclusão e segurança.
6. O trabalho de inventário não lê segredos, não consulta/escreve em bases reais e não modifica comportamento de runtime.

## Critério de conclusão da iniciativa completa

A iniciativa global só estará concluída quando todos os dados persistentes próprios de cada funcionalidade tiverem uma fonte de verdade PostgreSQL, ecrãs e APIs usarem os caminhos de leitura/escrita correspondentes, os dados existentes forem migrados e reconciliados com segurança, e uma auditoria transversal confirmar que não restam fontes locais de verdade em produção. A existência de tabelas, migrations, seeds ou testes isolados não é prova suficiente.
