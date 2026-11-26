# Especificação: `identity-access` — fluxos restantes

**Estado:** especificação aprovada pelo utilizador em 2026-10-23; plano aprovado para execução Native no checkout atual
**Data:** 2026-10-23
**Escopo:** capacidades de `identity-access` ainda fora da fatia aprovada de contexto de sessão e middleware
**Compatibilidade:** preservar contratos HTTP, políticas de acesso e dados existentes durante a extração

## Objetivo

Completar a extração do contexto `identity-access` para o monólito modular, transferindo os casos de uso de autenticação, credenciais, sessões, MFA, ciclo de vida da conta e convites de equipa para o módulo, sem uma migração em bloco nem alterações implícitas aos contratos públicos.

Esta especificação complementa a fatia já aprovada de resolução de contexto e middleware de sessão. A implementação dos fluxos aqui descritos só começa depois de esta especificação e o respetivo plano detalhado serem aprovados.

## Contexto observado

- `server.ts` ainda contém as rotas de login, registo, MFA, logout, revogação de sessões, consulta de sessão, alteração/recuperação de senha, desativação/eliminação de conta e convites de equipa.
- A resolução de contexto e os middlewares de acesso já estão em `server/modules/identity-access/`; `server/sessionService.ts` ainda gere criação, consulta e revogação de sessões.
- `server/authService.ts`, `server/postgresAuthService.ts` e `server/mfaService.ts` contêm persistência e regras de identidade em serviços fora do módulo.
- A aplicação suporta armazenamento JSON e PostgreSQL. MFA TOTP depende atualmente de PostgreSQL e aplica-se ao fluxo de administrador.
- A sessão usa o cookie `guigui_session`, duração de sete dias e hash do token. O reset de senha usa token de utilização única com expiração de 15 minutos; atualmente o token aparece como chave em texto simples no ficheiro JSON, embora também seja guardado um hash. Convites de equipa usam token de utilização única com expiração de 48 horas e guardam o hash.
- O registo de uma conta empresarial coordena persistência da conta com a criação/associação de um perfil empresarial e contém compensações em caso de falha.
- Os convites são expostos nas rotas `/api/business/team/invitations`; o fluxo cria/inspeciona/aceita convites e associa a conta criada ao contexto empresarial.
- O frontend consome os contratos existentes de login/registo, convites, recuperação e alteração de senha. Esta extração não altera componentes nem fluxos de interface.

## Escopo

### Incluído

- Login e registo de utilizadores e contas empresariais.
- Criação, leitura, logout e revogação de sessões, incluindo persistência atualmente mantida em `server/sessionService.ts`.
- Configuração, ativação e verificação de MFA.
- Alteração de senha e pedido/consumo de reset de senha.
- Desativação e eliminação de conta, incluindo revogação das sessões associadas.
- Criação, inspeção e aceitação de convites de equipa, incluindo associação da conta ao convite.
- Alterar o armazenamento JSON de reset para persistir apenas o hash do token; migrar o formato existente usando o hash já guardado para preservar tokens pendentes quando os dados permitirem.
- Composição dos casos de uso do módulo com as rotas atuais e com os contratos publicados dos contextos consumidores/proprietários.

### Fora do escopo

- Alterar endpoints, métodos HTTP, formatos de pedido/resposta, códigos de estado ou códigos de erro existentes.
- Alterar políticas de autenticação, roles, MFA, requisitos de senha, validade de sessão/token, cookies ou comportamento de contas desativadas.
- Alterar o esquema PostgreSQL ou migrar outros dados de identidade, substituir o armazenamento JSON ou adicionar dependências. A única migração de formato prevista é a normalização do ficheiro de tokens de reset descrita no escopo.
- Alterar a interface, a entrega de e-mail ou o fluxo de onboarding.
- Migrar qualquer outro contexto de negócio ou converter o monólito em serviços distribuídos.

## Propriedade e fronteiras

`identity-access` é proprietário de contas, credenciais, autenticação/autorização, sessões, fatores MFA, recuperação de senha e do ciclo de vida do convite, incluindo os seus tokens e a aceitação que cria/associa uma conta.

`business-discovery` continua proprietário dos perfis empresariais e das regras que determinam a validade de uma associação empresarial e das permissões de equipa. Os casos de uso de identidade devem consumir contratos publicados para validar ou concluir essas associações; não podem importar repositórios, modelos ou serviços internos de `business-discovery`.

O registo empresarial é uma coordenação entre contextos: `identity-access` gere a conta e as credenciais; `business-discovery` cria/associa o perfil empresarial através de uma porta explícita. A compensação de efeitos parciais deve permanecer explícita e testável até existir uma decisão aprovada para uma estratégia transacional diferente.

## Abordagem arquitetural

Executar uma extração incremental por fatias verticais dentro do monólito modular:

1. Caracterizar os contratos atuais, normalizar com segurança o ficheiro de tokens de reset e introduzir apenas as portas/adaptadores necessários para as operações de sessão e identidade.
2. Extrair as operações de sessão e compor login/logout/registo através dos casos de uso de `identity-access`.
3. Extrair MFA e alteração/recuperação de senha.
4. Extrair desativação/eliminação de conta e coordenar a revogação de sessões.
5. Extrair o ciclo de convites, usando o contrato publicado de `business-discovery` para a associação empresarial/permissões.
6. Concluir a composição HTTP, remover duplicação legada que tenha sido substituída e validar os contratos de ponta a ponta.

Cada fatia deve possuir um caso de uso de aplicação sem dependência de Express ou de detalhes de persistência. Os adaptadores devem encapsular os serviços PostgreSQL/JSON existentes enquanto estes forem necessários. O módulo publica apenas tipos e operações necessários aos consumidores; a composição continua em `server.ts` até que a extração de rotas seja demonstrada e aprovada dentro da própria fatia.

Não criar uma estrutura de pastas ou abstrações antecipadamente sem necessidade demonstrada. Aplicar a organização existente de `server/modules/identity-access/application` e `http`; adicionar adaptadores de persistência apenas quando a operação transferida os exigir.

## Contratos e compatibilidade

- Manter os caminhos, métodos, parâmetros, payloads, respostas, códigos de estado e mensagens/códigos de erro atuais.
- Manter o cookie `guigui_session`, a duração de sessão, o formato de token e as regras de revogação atuais.
- Manter roles, permissões, auditoria e associação ao perfil empresarial, exceto quando uma decisão de segurança ou produto separada for aprovada.
- Manter a seleção atual de fornecedor de persistência e os dados existentes; não fazer gravações duplicadas novas nem migrações de esquema/dados fora da normalização do ficheiro de tokens de reset aprovada.
- Encaminhar falhas operacionais ao middleware de erro; não convertê-las em sessão ausente, sucesso vazio, autenticação recusada ou fallback silencioso.
- Preservar a compensação do registo empresarial e reportar/auditar falhas de compensação sem ocultá-las.
- Não introduzir novas exposições de tokens, hashes, segredos MFA ou hashes de senha em DTOs/logs. Preservar o campo `resetToken` atualmente disponibilizado apenas em ambiente não produtivo. O armazenamento JSON de reset é a exceção aprovada: remover o token bruto da persistência e manter o hash como identificador/verificador.

Antes de cada fatia, testes de caracterização devem fixar as respostas HTTP e os efeitos observáveis existentes. Comportamentos sensíveis que dependam de identidade ou de tokens devem ser caracterizados e avaliados explicitamente: esta especificação não autoriza a alteração silenciosa das políticas nem a propagação automática de um comportamento inseguro para uma nova implementação. Qualquer correção que altere um contrato ou uma política deve ser separada, justificada e aprovada.

## Estratégia de testes

- Testes unitários para cada caso de uso, dependências ausentes, resultados negativos e falhas operacionais.
- Testes de contrato para portas de sessão, contas, MFA, tokens e colaboração com `business-discovery`.
- Testes HTTP de caracterização para os endpoints preservados, incluindo cookies, códigos de estado, corpos, auditoria e encaminhamento de erros.
- Testes de persistência para os adaptadores JSON e PostgreSQL que forem efetivamente alterados.
- Testes de integração PostgreSQL somente com `TEST_DATABASE_URL` isolada e seed confirmado; nunca usar uma base de dados de aplicação ou credenciais de `.env` sem autorização explícita.
- Testes de registo empresarial para sucesso, conflito, falha de associação e compensação parcial.
- Testes de ciclo de vida que confirmem revogação de sessões em logout, revogação global, desativação e eliminação, conforme o contrato atual.
- Executar as verificações focadas do repositório e, quando o ambiente permitir, a suíte unitária, verificação de tipos e build.

## Critérios de aceitação

- Todos os fluxos incluídos são compostos por casos de uso de `identity-access`; `server.ts` deixa de conter regras de negócio/persistência de identidade que tenham sido migradas.
- Nenhum módulo consumidor acede diretamente à persistência ou a modelos internos de `identity-access` ou `business-discovery`.
- O registo empresarial e os convites atravessam as fronteiras por contratos publicados, mantendo resultados e compensações caracterizados.
- Os contratos HTTP, políticas e dados PostgreSQL permanecem compatíveis com a linha de base aprovada; o formato do ficheiro de reset é normalizado conforme a decisão explícita registada.
- O ficheiro de reset deixa de conter tokens brutos; a migração preserva tokens não expirados quando os hashes existentes permitem e testa explicitamente os registos legados inválidos.
- Falhas operacionais e de compensação são observáveis e não se apresentam como sucesso ou credenciais inválidas.
- Os testes aplicáveis passam; testes que exigem infraestrutura não configurada ficam identificados, sem usar dados ou bases não confirmados.

## Riscos e decisões explícitas

- **Convites e propriedade empresarial:** a decisão aprovada atribui a `identity-access` o ciclo e a aceitação do convite. A validação da associação/permissões empresariais continua a pertencer a `business-discovery`, através de contrato.
- **Registo empresarial parcialmente concluído:** sem transação distribuída, o caso de uso precisa manter compensação explícita e testes de falha.
- **Vários fornecedores de persistência:** diferenças entre JSON e PostgreSQL podem revelar contratos divergentes; caracterizar antes de mover lógica e não assumir equivalência não comprovada.
- **Comportamentos de segurança existentes:** alteração de senha e receção de tokens de convite devem ser revistos durante a caracterização. O utilizador aprovou remover o token bruto do ficheiro JSON de reset; a migração deve usar o hash já persistido para preservar tokens não expirados sempre que possível e tornar explícita qualquer invalidação inevitável.
- **Integração de MFA:** manter a dependência e o comportamento atuais; suporte a outro fornecedor ou a outras roles requer decisão separada.

## Decisões registadas e requisitos para implementação

- **Aprovado pelo utilizador em 2026-10-23:** alterar o armazenamento de reset para hash-only. A alteração não muda a API; preservar resets ainda válidos através do hash já persistido sempre que possível.

1. Os testes de caracterização devem confirmar o comportamento exato das rotas e adaptadores, incluindo diferenças entre armazenamento JSON e PostgreSQL.
2. Se a caracterização encontrar outro comportamento inseguro ou incompatível entre os dois fornecedores, interromper apenas a fatia afetada e apresentar a decisão de política necessária antes de o codificar.

## Revisão de consistência

- A extração por fatias respeita a ordem aprovada dos contextos e não inicia `business-discovery`.
- Os convites pertencem ao ciclo de identidade conforme a decisão do utilizador; a propriedade de dados e regras empresariais não é deslocada implicitamente.
- A compatibilidade é uma restrição de migração, não uma autorização para manter silenciosamente uma falha de segurança: mudanças de política requerem aprovação separada.
- O plano de implementação separado está em [`docs/superpowers/plans/2026-10-23-guigui-identity-access-remaining.md`](../plans/2026-10-23-guigui-identity-access-remaining.md) e foi aprovado para execução Native no checkout atual em 2026-10-23. Nenhum fluxo além da fatia de sessões já aprovada e deste plano será implementado.
