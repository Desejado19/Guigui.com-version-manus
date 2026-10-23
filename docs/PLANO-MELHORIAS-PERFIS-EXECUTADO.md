# Guigui.com — Plano de melhorias executado

## Objetivo

Criar uma experiência coerente entre **Utilizador/Cidadão**, **Empresa** e **Administração**, com uma hierarquia clara de trabalho, ações prioritárias e interface visual consistente com o Design System Guigui.com.

## Hierarquia funcional aplicada

| Perfil | Fluxo principal | Âmbito |
|---|---|---|
| Utilizador | Explorar → Escolher → Comprar → Viver | Preferências e dados da própria conta |
| Empresa | Atrair → Publicar → Vender → Fidelizar | Apenas o negócio associado ao `businessId` |
| Administração | Supervisionar → Priorizar → Decidir → Auditar | Toda a plataforma, conforme permissões |

A navegação lateral existente foi preservada. A nova camada de workspace liga os módulos já existentes ao fluxo correto, evitando misturar operação empresarial com governação administrativa ou compras pessoais.

## O que foi executado

### 1. Componente comum de workspace

Criado `src/components/RoleWorkspaceHeader.tsx`, com:

- Contexto explícito do perfil e do âmbito de dados;
- Estado operacional visível;
- Fluxo hierárquico de quatro etapas;
- Ações prioritárias em cartões reutilizáveis;
- Contadores de pendências;
- Suporte a estados de sucesso, atenção, informação e perigo;
- Tokens de cor, raio, sombra e foco do Design System existente;
- Layout responsivo e acessível por teclado.

### 2. Painel da Empresa

Integrado no `BusinessDashboard`:

- Estado do plano empresarial;
- Âmbito do negócio e bairro;
- Atalho para próximos eventos;
- Atalho para conteúdo e moderação;
- Atalho para bilhetes e scanner;
- Atalho para mensagens e clientes;
- Contagem de pendências baseada nos dados já carregados;
- Navegação direta para os módulos existentes.

### 3. Área do Utilizador/Cidadão

Integrado no `CitizenDashboard`:

- Contexto da conta e localização do cidadão;
- Atalho para explorar a plataforma;
- Carteira de bilhetes com acesso direto;
- Novidades e notificações pendentes;
- Suporte com entrada direta;
- Fluxo visual que conecta descoberta, compra e utilização.

### 4. Administração e Moderação

Integrado no `AdminDashboard`:

- Centro de governação no topo da área administrativa;
- Contagem de itens pendentes de moderação;
- Empresas que exigem verificação;
- Tickets de suporte pendentes;
- Acesso direto à auditoria;
- Separação visual entre supervisão, prioridade, decisão e auditoria;
- Estado operacional dependente da fila de moderação.

## Regras de coerência e segurança preservadas

- A empresa continua limitada ao próprio `businessId`.
- O cidadão continua limitado aos próprios bilhetes, compras, mensagens e suporte.
- A Administração continua separada da operação de scanner e compradores das empresas.
- Os atalhos apenas mudam o módulo já autorizado; não criam novas permissões no cliente.
- As autorizações e validações de backend existentes não foram substituídas por botões visuais.
- A nova camada usa componentes e tokens existentes, sem introduzir uma paleta paralela.

## Validação executada

- `npm ci --no-audit --no-fund` — concluído;
- `npm run check` — concluído sem erros TypeScript;
- `npm run build` — concluído com sucesso;
- `npm run test:components` — 5 ficheiros e 40 testes aprovados;
- Build produziu os chunks dos três dashboards e do novo workspace partilhado.

## Próxima fase recomendada

1. Adicionar testes de interação específicos para os novos cartões de ação;
2. Validar a experiência visual em desktop, tablet e telemóvel com os três perfis demo;
3. Ligar os contadores a endpoints agregados em produção quando a fonte deixar de ser local;
4. Evoluir o centro administrativo para fila de tarefas com SLA e atribuição;
5. Evoluir a carteira cidadã para cache offline explicitamente sincronizada;
6. Adicionar telemetria dos eventos `workspace_action_clicked` e `workspace_flow_step_viewed`.
