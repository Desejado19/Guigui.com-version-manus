# Especificação: carga sintética PostgreSQL para importação no pgAdmin

**Estado:** desenho aprovado em conversa; revisão do documento pendente  
**Data:** 2026-10-23  
**Escopo:** preparar exatamente 1.000 linhas sintéticas de domínios funcionais para uma base local PostgreSQL 18 descartável  
**Importação:** ficheiro SQL aberto no Query Tool do pgAdmin

## Objetivo

Preparar uma carga reproduzível e relacional que torne os serviços de marketplace, bilhética, transações simuladas, monetização, comunicação, suporte e moderação demonstráveis numa base PostgreSQL 18 local. A carga deve ficar pronta como ficheiro importável, sem depender da localização ou credenciais da base, que serão fornecidas mais tarde pelo utilizador.

## Decisões aprovadas

- O conjunto contém exatamente 1.000 linhas sintéticas de domínio; as 92 linhas de referência do catálogo de categorias não entram nessa contagem.
- A importação será feita através de um ficheiro SQL no Query Tool do pgAdmin, sem integração pgAdmin disponível nesta sessão.
- Os dados serão fictícios, com identificadores próprios, relações válidas e sem dados pessoais reais.
- A carga não será executada até o alvo ser identificado como uma nova base PostgreSQL 18 local, descartável e apropriada para testes.
- Não usar a `DATABASE_URL` existente como alvo nem ler ou mostrar credenciais.
- Pagamentos são apenas registos sintéticos de teste. Não haverá chamadas a provedores externos, webhooks reais ou credenciais utilizáveis.
- Utilizadores seed ficam desativados e não terão credenciais de login utilizáveis.

## Composição dos 1.000 registos

| Domínio | Tabela | Linhas |
|---|---|---:|
| Identidade | `users` | 50 |
| Marketplace | `companies` | 30 |
| Marketplace | `company_members` | 30 |
| Agenda | `events` | 30 |
| Bilhética | `ticket_types` | 60 |
| Bilhética | `ticket_reservations` | 100 |
| Comércio | `orders` | 80 |
| Bilhética | `tickets` | 80 |
| Pagamentos simulados | `payment_transactions` | 80 |
| Monetização | `commissions` | 30 |
| Monetização | `refunds` | 10 |
| Monetização | `plans` | 4 |
| Monetização | `subscriptions` | 30 |
| Confiança | `reviews` | 70 |
| Moderação | `moderation_items` | 30 |
| Comunicação | `notifications` | 66 |
| Comunicação | `conversations` | 30 |
| Comunicação | `conversation_messages` | 80 |
| Suporte | `support_tickets` | 20 |
| Suporte | `support_replies` | 30 |
| Monetização | `monetization_ledger` | 30 |
| Monetização | `monetization_wallets` | 30 |
| **Total** |  | **1.000** |

As relações serão coerentes: empresas terão proprietários e membros seed; eventos pertencerão a empresas; tipos, reservas, pedidos e bilhetes apontarão para eventos existentes; comissões e reembolsos apontarão para transações; subscrições apontarão para planos; avaliações, moderação, notificações, conversas e suporte apontarão para entidades existentes.

As reservas serão históricas, confirmadas, libertadas ou expiradas; nenhuma ficará pendente a bloquear inventário. Transações usarão um provedor sintético e modo de teste. Mensagens, avaliações e títulos serão marcados como demonstração quando apresentados ao utilizador.

## Fora de escopo

Não criar dados nas tabelas de sessões, MFA, limites de acesso, métricas de pedidos, filas de execução, auditoria, eventos de pagamento de provedores, fatores/challenges de autenticação ou estado operacional da aplicação. Esses registos podem alterar controlos de segurança, métricas reais ou filas, e não são necessários para povoar os fluxos de negócio.

Os utilizadores seed não poderão autenticar-se. Fluxos de autenticação interativos continuam a exigir fixtures controladas de teste, fora deste ficheiro importável. A carga não simula tráfego, concorrência, milhões de acessos ou desempenho; esses testes permanecem numa etapa separada.

## Artefactos propostos

- `scripts/generate-postgres-synthetic-seed.ts`: gerador offline e determinístico; não cria uma ligação ao banco.
- `db/seeds/guigui-synthetic-1000.sql`: ficheiro SQL gerado e pronto para ser revisto/importado no pgAdmin após a configuração do nome esperado da base.
- Testes do gerador: verificar a contagem por tabela, o total de 1.000 linhas, as relações entre IDs e a ausência de credenciais ou dados não sintéticos.
- Instruções de importação e relatório de contagens por domínio no próprio SQL ou na documentação associada.

## Segurança e comportamento da importação

1. O SQL inicia uma transação e aborta se a versão do servidor não for PostgreSQL 18, se o nome atual não corresponder ao nome esperado configurado para a base descartável ou se o esquema obrigatório não existir.
2. A primeira execução exige que as tabelas de domínio alvo estejam vazias, exceto pelas referências previamente aprovadas. A seed grava um marcador/versionamento próprio em `app_state`, fora da contagem de 1.000 linhas. Uma importação anterior só será aceite quando esse marcador corresponder à mesma versão/hash do conjunto.
3. Todos os IDs usam o prefixo `synthetic_`; conflitos repetidos usam `ON CONFLICT DO NOTHING`.
4. O ficheiro nunca usa `DELETE`, `TRUNCATE`, `DROP`, atualizações de linhas não pertencentes à seed ou chamadas de rede.
5. Uma falha reverte a transação. Uma consulta final apresenta contagens por tabela e total esperado.
6. O nome esperado da base fica como placeholder até o utilizador fornecer a localização; enquanto não for preenchido, o ficheiro não pode ser executado com sucesso.

## Pré-requisitos e execução

- O utilizador cria uma nova base local descartável na instância PostgreSQL 18.
- O projeto aplica as migrations com o runner existente e sem ligar a seed ao arranque normal do servidor.
- O catálogo de categorias é semeado através do script existente, limitado aos IDs de referência próprios.
- O utilizador abre `db/seeds/guigui-synthetic-1000.sql` no Query Tool do pgAdmin, depois de o nome esperado ser configurado e verificado.
- A validação posterior confirma a configuração do banco na API, as contagens por tabela, a integridade referencial, a pesquisa e a apresentação dos dados na interface.

Nenhuma escrita é feita nesta fase de desenho. O teste integrado depende do alvo e da autenticação local ainda não fornecidos.

## Critérios de aceitação

1. O gerador funciona sem ligação ao PostgreSQL e produz o SQL determinístico.
2. Os testes verificam as 1.000 linhas e todas as dependências referenciadas.
3. Nenhuma credencial utilizável, dado pessoal real, pedido real ou efeito externo está no conjunto.
4. O SQL recusa servidor, nome de base, esquema ou estado de seed incompatíveis.
5. A primeira importação numa base nova é transacional; a repetição do mesmo conjunto não duplica nem altera dados.
6. A importação preserva qualquer linha sem prefixo/identificador pertencente à seed e nunca apaga dados.
7. As verificações de API, UI e PostgreSQL só são executadas depois de o alvo PG18 descartável ser confirmado.
