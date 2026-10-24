# Design: implantação Render e conclusão do monólito modular Guigui.com

**Estado:** desenho arquitetural aprovado em conversa; aguarda revisão do documento pelo utilizador
**Data:** 2026-10-24
**Escopo:** preparar uma nova implantação de produção no Render e completar, evolutivamente, a arquitetura de monólito modular com DDD pragmático
**Compatibilidade:** preservar o serviço e domínio atuais, contratos HTTP, dados e comportamento até validação explícita

## Objetivo

Disponibilizar uma nova instância de produção do Guigui.com numa URL própria do Render, sem substituir o serviço nem alterar o domínio atuais. A primeira publicação mantém a aplicação como monólito e as integrações externas simuladas. Depois de validada a implantação, concluir a migração do backend para os sete contextos delimitados no mapa de capacidades aprovado.

O objetivo não é criar microserviços nem reescrever a SPA. O sistema permanece uma aplicação React e Express, executada como monólito. A modularização é uma fronteira de código e propriedade dentro do processo.

## Decisões confirmadas

- Criar um novo serviço de produção no Render; não substituir o serviço atual.
- Validar primeiro na URL própria do Render. Não alterar ou transferir o domínio atual como parte deste trabalho.
- Usar a base PostgreSQL existente. Não executar migrações de schema automaticamente no arranque. Verificar compatibilidade antes de permitir tráfego de escrita.
- Inventariar e preservar os dados JSON existentes antes de liberar a nova instância; não presumir que esses ficheiros estão vazios.
- Manter pagamentos, SMS, email e outros fornecedores em modo simulado. Nenhuma credencial de fornecedor real será ativada nesta publicação.
- Não provisionar recursos pagos antes de apresentar a estimativa de custo e obter aprovação do limite.
- Guardar segredos somente em variáveis privadas do serviço Render; nunca em código, logs, commits ou chat.
- Executar a migração DDD sequencialmente, com contratos existentes e testes de regressão preservados.

## Estado atual observado

- `server/entrypoint.ts` prepara o runtime e importa a aplicação.
- `server.ts` continua a montar a aplicação Express, rotas, middleware e parte da composição. Tem aproximadamente quatro mil linhas e importa serviços de vários contextos.
- `server/modules/platform-foundation/` contém partes de configuração, health, hosting e observabilidade.
- `server/modules/identity-access/` contém partes de domínio, aplicação, adaptadores e composição de identidade e sessões.
- O caso de uso de compra de bilhetes existe em `server/ticketPurchaseUseCase.ts`, ainda fora do módulo `events-ticketing`.
- Os outros contextos de negócio continuam sobretudo em serviços na raiz de `server/` e em rotas de `server.ts`.
- PostgreSQL é selecionado por `DATABASE_URL`, mas partes do estado continuam em ficheiros JSON. A SPA também usa `localStorage`; algumas chaves são sincronizadas pela API.
- A documentação aprovada já define a arquitetura alvo e a ordem de migração em `CAPABILITY-MAP.md` e em `docs/superpowers/specs/2026-10-22-guigui-modular-ddd-migration-design.md`.

Este inventário é estrutural, não uma prova de que cada fluxo, dado ou integração funciona atualmente em produção.

## Arquitetura alvo

```text
Navegador
  └─ SPA React
      └─ HTTP /api
          └─ Express — um processo e um serviço web Render
              ├─ adaptadores HTTP e composition root
              ├─ platform-foundation
              ├─ identity-access
              ├─ business-discovery
              ├─ payments-monetization
              ├─ events-ticketing
              ├─ communication-support
              └─ governance-operations
                  ├─ portas e casos de uso publicados
                  ├─ adaptadores PostgreSQL e JSON
                  └─ integrações externas explicitamente simuladas
```

Cada contexto é autoridade sobre as suas regras e operações. O domínio não depende de Express, SQL ou interface visual; a aplicação coordena casos de uso por portas explícitas; os adaptadores fazem HTTP, persistência e integração; o composition root conecta as implementações. Consumidores usam IDs, DTOs e contratos publicados, nunca repositórios ou tabelas internas de outro contexto.

`server.ts` deve encolher gradualmente para composição e compatibilidade HTTP. As rotas existentes podem permanecer adaptadores enquanto são migradas. A estrutura dos diretórios só cresce quando um contexto realmente precisa dessas camadas; não criar camadas vazias ou infraestrutura genérica sem consumidor.

## Módulos e ordem

| Ordem | Contexto | Responsabilidade |
|---|---|---|
| 1 | `platform-foundation` | Inicialização, configuração, saúde, observabilidade e contratos técnicos |
| 2 | `identity-access` | Contas, credenciais, sessões, autenticação e autorização |
| 3 | `business-discovery` | Empresas, diretório, feed, ofertas e avaliações |
| 4 | `payments-monetization` | Pagamentos, subscrições, catálogo comercial, taxas, reconciliação e reembolsos |
| 5 | `events-ticketing` | Eventos, inventário, reservas, emissão, acesso e scanner; integrar o caso de uso de compra existente sem duplicar regras |
| 6 | `communication-support` | Conversas, mensagens, suporte e notificações |
| 7 | `governance-operations` | Moderação, denúncias, auditoria e operações administrativas |

As dependências seguem `CAPABILITY-MAP.md`, sem ciclos. Comunicação e governança dependem da fundação e identidade; quando necessário, usam contratos publicados dos contextos operacionais. Eventos podem integrar empresas e pagamentos através dos contratos aprovados.

## Implantação Render

- Um novo serviço web Node executa a SPA e a API Express no mesmo processo, usando os scripts `build` e `start` existentes após verificação local.
- O processo respeita a porta injetada pelo Render e expõe o endpoint de saúde existente. A configuração definitiva de health check e runtime será verificada contra a plataforma antes da publicação.
- A nova instância usa a URL fornecida pelo Render. Não recebe o domínio atual durante esta iniciativa.
- A ligação ao PostgreSQL existente é configurada como segredo no serviço. O processo de release não aplica migrations automaticamente; qualquer alteração de schema exige análise e aprovação separadas.
- Não se ativa tráfego de produção até validar a compatibilidade entre o código novo, o schema existente e os dados que a aplicação já possui.
- Qualquer ficheiro JSON necessário deve ter a sua origem inventariada e ser preservado. O filesystem efémero de um serviço web não é aceite como persistência durável.
- A alternativa de disco persistente, migração JSON→PostgreSQL ou outra solução de armazenamento deve ser comparada com custos atuais e requisitos de dados. Recursos pagos só podem ser provisionados depois da estimativa e aprovação do limite mensal.
- Não executar deploy externo se não houver credenciais Render autenticadas e seguras no ambiente. A configuração versionada pode ser preparada; sem acesso ao Render, a criação e ativação do serviço ficam como passo manual documentado.

## Dados, persistência e compatibilidade

Antes da primeira publicação:

1. Inventariar ficheiros JSON usados em runtime, dados da aplicação antiga, backups e chaves de `localStorage` sincronizadas.
2. Identificar para cada recurso o sistema de registo atual, o adaptador usado com PostgreSQL configurado e as consequências de uma instância nova sem os ficheiros locais existentes.
3. Criar e verificar uma cópia de segurança antes de copiar, transformar ou importar dados.
4. Definir a persistência durável da nova instância e validar a restauração de uma cópia em ambiente isolado.
5. Bloquear a liberação do serviço se houver dados necessários sem origem, destino ou plano de recuperação conhecidos.

O uso da mesma base significa que os dois serviços podem escrever simultaneamente nos mesmos dados. Portanto, a nova versão não pode pressupor alterações de schema incompatíveis, nem ativar escrita antes de a compatibilidade entre versões ser verificada. Não há escrita dupla nem migração de dados implícita.

Os contratos HTTP, permissões e formatos de resposta observáveis permanecem estáveis. Mudanças de comportamento ou de schema exigem aprovação específica, testes de contrato e plano de reversão.

## Segurança e operação

- Não incluir valores de `DATABASE_URL`, segredos, tokens ou credenciais em ficheiros versionados, argumentos de linha de comando persistidos, logs, relatórios ou mensagens.
- Conservar as verificações de configuração de produção e a classificação honesta da saúde da dependência PostgreSQL.
- Tratar uma base configurada mas indisponível como falha/degradação explícita; não alternar silenciosamente para JSON.
- Conservar integrações simuladas identificadas como simuladas; não alegar que fornecedores foram contactados.
- Usar apenas contas e dados sintéticos nos smoke tests da URL nova, exceto quando um teste controlado de dados reais for especificamente aprovado.
- O plano de rollback inicial é deixar o serviço e o domínio atuais intactos e parar/desativar apenas a nova instância, sem apagar a base existente. O efeito de quaisquer escritas feitas pelo serviço novo deve ser avaliado antes desse rollback.

## Validação e critérios de aceitação

### Publicação inicial

- `npm run check`, testes unitários focados e `npm run build` passam no commit candidato, ou as limitações preexistentes são identificadas e tratadas como bloqueios explícitos.
- A configuração de deploy e o comando de arranque são testados localmente; o servidor atende na porta atribuída e o health check não afirma sucesso saudável quando o PostgreSQL configurado está indisponível.
- Todos os segredos são injetados pelo ambiente privado Render; nenhum segredo aparece no bundle, repositório, logs ou artefactos.
- Inventário, cópia e persistência dos dados JSON são verificados antes de permitir operações que os alterem.
- A nova URL responde e os fluxos selecionados de leitura e escrita são testados com dados sintéticos, sem alterar domínio ou tráfego da instância atual.
- Nenhuma fase é declarada concluída com contagens placeholder ou smoke tests sem execução real.

### Migração DDD completa

- Os sete contextos do mapa existem no código onde houver responsabilidade real e têm propriedade explícita sobre regras, casos de uso e adaptadores próprios.
- `server.ts` não concentra regras de negócio dos sete contextos; permanece composition root/adaptador até estar seguro remover compatibilidade antiga.
- As dependências dos módulos respeitam o mapa, não têm ciclos e não acessam persistência interna de outro contexto.
- Testes de domínio/aplicação são independentes de HTTP e PostgreSQL; testes de adaptador e contrato verificam persistência e rotas existentes.
- Os fluxos principais — identidade, empresas, pagamento, compra/reserva/emissão de bilhetes, comunicação e governança — preservam contratos e permissões com testes de regressão.
- `npm run check`, `npm run test:unit`, `npm run build` e os testes de integração/E2E aplicáveis passam; integrações que exigem ambiente isolado são explicitamente marcadas se não estiverem disponíveis.
- O serviço Render permanece utilizável e validado ao longo das fatias; o domínio atual não muda sem decisão posterior.

## Fases de execução

1. **Baseline e pré-requisitos:** confirmar branch/estado do repositório, comandos, testes, deploy atual sem alterações, acesso Render e variáveis necessárias sem revelar segredos.
2. **Auditoria de dados:** inventariar as fontes PostgreSQL, JSON, backups e estado sincronizado do browser; apresentar riscos e estimativa de armazenamento.
3. **Preparação Render:** implementar configuração versionada e documentação apenas após aprovação do plano e do custo; validar build, start, health e destino PostgreSQL sem executar migrations.
4. **Nova instância:** provisionar apenas após autenticação Render e aprovações; publicar na URL própria, executar smoke tests e preservar o serviço atual.
5. **Migração DDD:** preparar um plano de implementação por contexto e seguir a ordem aprovada. Cada contexto requer especificação/plano próprios, execução incremental e validação antes do próximo.
6. **Encerramento:** rever arquitetura e dependências, executar a campanha de QA segura que estiver desbloqueada e apresentar os resultados reais. A troca do domínio exige uma decisão e etapa separadas.

## Fora do escopo

- Substituir ou desligar o serviço atual, alterar DNS/domínio ou transferir tráfego sem aprovação posterior.
- Criar microserviços, reorganizar a SPA ou reescrever todos os fluxos num único bloco.
- Ativar credenciais/provedores de pagamentos, SMS, email ou IA reais.
- Executar migrations, importar dados de produção, apagar ficheiros ou alterar schema sem plano e aprovação específicos.
- Provisionar recursos pagos antes de comunicar e receber aprovação da estimativa.
- Enviar segredos ou dados pessoais no chat ou a serviços externos não autorizados.

## Riscos e bloqueios

- **Acesso Render:** não há integração Render autenticada disponível nesta sessão. A implantação direta depende de CLI autenticado ou ação no painel pelo utilizador.
- **Dados JSON:** o novo serviço não herda ficheiros do serviço atual. A falta de inventário, cópia verificável ou armazenamento durável bloqueia publicação com escrita.
- **Base partilhada:** duas versões podem escrever simultaneamente; incompatibilidade de schema ou lógica de dados bloqueia a ativação da nova instância.
- **Custos:** a solução durável pode exigir recurso pago. É obrigatória estimativa atual antes do provisionamento.
- **Validação de ambiente:** o QA live depende de variáveis locais, `k6` e `psql` ainda indisponíveis no último preflight. Resultado bloqueado não é aprovação de qualidade de produção.
