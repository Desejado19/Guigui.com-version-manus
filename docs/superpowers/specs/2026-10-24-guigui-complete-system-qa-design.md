# Especificação: campanha completa de QA local do Guigui.com

**Estado:** desenho aprovado em conversa; revisão do documento pendente  
**Data:** 2026-10-24  
**Escopo:** campanha reprodutível de testes funcionais, de API, carga controlada e baseline de segurança no ambiente local descartável  
**Alvo:** aplicação própria em `127.0.0.1` e uma nova base PostgreSQL 18 descartável

## Objetivo

Validar os fluxos de utilizador e os contratos da API de ponta a ponta com Playwright, Postman/Newman, k6 e OWASP ZAP, usando somente dados sintéticos e uma instância local isolada. O resultado será um relatório que distingue cobertura aprovada, falhas reais, limitações do ambiente e achados de segurança, sem apresentar a campanha como prova de ausência de vulnerabilidades.

## Situação atual observada

- O repositório tem 17 especificações Playwright em `tests/*.spec.ts`.
- A configuração Playwright atual não inicia um servidor próprio e assume um servidor existente na porta 3000; a campanha precisa de uma configuração isolada para não atingir esse processo.
- Algumas jornadas Playwright dependem de contas demo e de entidades fixas, enquanto o seed sintético atual mantém as contas desativadas.
- `docs/openapi.json` descreve seis caminhos, portanto não é cobertura suficiente da API para uma coleção Postman completa.
- Newman está disponível no PATH local. Os comandos `k6`, `zap`, `ZAP`, `postman` não foram encontrados no PATH durante a preparação.
- Um relatório ZAP passivo local anterior registou quatro alertas de CSP wildcard de risco médio/confiança alta, um de risco baixo e dois informativos. Deve ser tratado apenas como baseline anterior até ser reproduzido no estado atual.
- A execução k6 anterior mediu apenas `GET /api/health`, com máximo de 10 VUs durante 60 segundos; não validou a API de negócio nem PostgreSQL.

## Decisões aprovadas

- A campanha será executada localmente e apenas no ambiente descartável controlado pelo utilizador.
- Será criada uma nova base PostgreSQL 18 dedicada à QA. A base existente, `DATABASE_URL` e dados existentes não serão lidos, reutilizados, alterados ou eliminados.
- O alvo HTTP ficará limitado a `127.0.0.1` numa porta dedicada; a porta 3000 não será usada nem assumida como alvo.
- Dados de teste serão fictícios. Pagamentos, SMS, email e outros efeitos externos serão simulados ou desativados.
- O banco criado será mantido após a campanha; não haverá `DROP`, `TRUNCATE` nem limpeza destrutiva automática.
- Postman será utilizado por uma coleção local executada através de Newman; a coleção e quaisquer dados/credenciais não serão enviados ao Postman Cloud.
- k6 fica limitado a no máximo 10 VUs durante 60 segundos, apenas em endpoints de leitura.
- ZAP fica limitado ao baseline passivo sobre localhost. Active scan, exploração, fuzzing agressivo e alvos externos estão fora de escopo.
- Falhas e achados serão relatados. Esta campanha não inclui alteração automática de código de produção nem correção automática de vulnerabilidades.
- Se k6 ou ZAP não estiverem instalados localmente, a execução dessa ferramenta fica bloqueada até o utilizador aprovar separadamente a instalação.

## Responsabilidades por ferramenta

| Ferramenta | Responsabilidade | Limites |
|---|---|---|
| Playwright | Fluxos completos de UI existentes: carregamento, navegação, autenticação, painéis, perfil de empresa, eventos/bilhetes e operações administrativas presentes na suíte | Configuração própria e servidor local isolado; fixtures dedicadas; nenhuma conta real |
| Postman/Newman | Smoke e contrato de endpoints da API, autenticação/autorização, entradas inválidas, estados de erro e fluxos seguros de leitura/escrita | Coleção local; não confiar apenas nos seis caminhos atuais do OpenAPI; escritas somente na base descartável; integrações simuladas |
| k6 | Smoke/carga baixa para endpoints HTTP read-only e saudáveis do sistema | Máximo 10 VUs/60 s; limiares `p(95) < 2000 ms`, `http_req_failed < 1%`, checks 100%; sem transações ou endpoints de escrita |
| OWASP ZAP | Baseline passivo de headers, cookies e conteúdo observado no site/API local | Target allowlist apenas em `127.0.0.1`; nenhum active scan; comparar e classificar diferenças da baseline anterior |

## Preparação e isolamento

1. Confirmar que a pasta de trabalho, o servidor alvo e a base de dados pertencem ao projeto local e à campanha.
2. Verificar que o nome de base reservado ao seed sintético está livre. O SQL atual só aceita `guigui_pg18_synthetic_target`; se essa base já existir, parar e solicitar uma decisão em vez de a reutilizar ou sobrescrever.
3. Criar a nova base PostgreSQL 18 e aplicar migrations explicitamente, sem executar comandos contra uma URL não verificada.
4. Carregar o seed sintético de 10.000 linhas e fixtures locais específicas para autenticação/jornadas que exigem contas ativas. As fixtures não podem habilitar credenciais externas nem reutilizar contas reais.
5. Iniciar um processo novo da aplicação numa porta loopback dedicada e com diretório de estado temporário; não usar o processo existente na porta 3000.
6. Executar um preflight que confirme hostname loopback, porta, nome da base esperada, versão PostgreSQL 18 e estado de saúde. Qualquer divergência interrompe a campanha antes dos testes.
7. Bloquear ou simular chamadas externas no ambiente de teste; Playwright, Newman, k6 e ZAP só podem comunicar com o alvo local explicitamente permitido.
8. Executar os instrumentos em sequência: Playwright, Newman, k6 e ZAP passivo. Cada fase conserva o resultado e indica claramente quando foi bloqueada.

Nenhum ficheiro `.env`, snapshot, valor de segredo ou conteúdo de dados existente será aberto. Valores de conexão só podem ser fornecidos diretamente ao processo local, não registrados no relatório nem enviados às ferramentas.

## Cobertura funcional e da API

- Playwright executa toda a suíte E2E `tests/*.spec.ts`; falhas existentes não são removidas, ignoradas ou reescritas para aparentar sucesso.
- A coleção Newman deve ser criada a partir do inventário de todas as rotas HTTP declaradas na aplicação, incluindo routers montados e API versionada/compatível. O OpenAPI existente serve como contrato parcial, não como lista exaustiva.
- Cada rota deve constar na matriz de cobertura: receberá um cenário apropriado e seguro, ou uma exclusão explícita com motivo (por exemplo, operação destrutiva não necessária ou efeito externo que não pode ser simulado).
- Para cada fluxo da API, a coleção deve identificar método/rota, pré-condições, autenticação requerida, cenário positivo seguro e respostas negativas aplicáveis.
- Testes de endpoints que criam estado podem executar apenas contra a base descartável e devem usar identificadores sintéticos exclusivos da execução.
- Se os fluxos críticos de UI dos papéis cidadão, empresa e administração não estiverem cobertos pela suíte existente, adicionar testes Playwright direcionados antes de declarar essa área coberta.
- Nenhum cenário contacta um provedor real de pagamentos, SMS ou email; callbacks de pagamento real e credenciais de produção não serão utilizados.
- Testes que não puderem correr por dependências de conta/fixture ou limitações do ambiente serão reportados como bloqueados, nunca omitidos silenciosamente.

## Execução de carga

- Executar k6 apenas após Playwright e Newman passarem pelo preflight da base e da aplicação.
- Usar no máximo 10 VUs por 60 segundos, apenas com pedidos HTTP GET para endpoints de leitura previamente aprovados.
- Limiares: p95 abaixo de 2.000 ms, taxa de falha abaixo de 1%, todos os checks aprovados.
- A saída de execução do k6 e os valores numéricos serão verificados; um summary JSON com flags de threshold inconsistentes não poderá ser tratado isoladamente como prova de sucesso.
- Interromper k6 se o alvo deixar de ser localhost, a saúde ficar degradada, surgirem erros sustentados ou qualquer comportamento indicar escrita/efeito inesperado.
- Estes números são uma smoke load local e não sustentam afirmações de capacidade em produção ou de milhões de utilizadores.

## Baseline de segurança

- ZAP deve observar exclusivamente o processo local com modo baseline/passivo, sem active scan, payload de exploração, fuzzing agressivo ou acesso a hosts externos.
- O relatório deve incluir contagem por risco/confiança, endpoints observados, alertas novos/resolvidos e comparação com os sete alertas da baseline anterior.
- Alertas serão apresentados como evidência de triagem, não como vulnerabilidades confirmadas sem validação apropriada.
- Qualquer segredo, dado pessoal real, comportamento inesperado fora do alvo ou indicação de acesso a um sistema não autorizado encerra imediatamente o teste correspondente.

## Relatório da campanha

Criar um relatório consolidado local sem segredos, cookies, tokens, dados de utilizadores ou payloads sensíveis. O relatório deve conter:

- commit/branch e momento da execução;
- versões das ferramentas e preflight do alvo, sem a string de conexão;
- comandos executados e perfis/limites;
- contagens de testes passados, falhados, ignorados e bloqueados;
- cobertura da coleção API por fluxo/rota;
- métricas k6 e avaliação dos thresholds;
- achados ZAP por severidade/confiança e delta em relação à baseline;
- limitações, logs sanitizados e próximos passos recomendados.

Relatórios completos das ferramentas podem conter URLs, respostas ou outros dados operacionais. Só publicar no repositório sumários sanitizados e artefactos explicitamente verificados; conservar artefactos brutos localmente.

## Fora de escopo

- Testar produção, staging, hosts públicos ou quaisquer alvos de terceiros.
- Active scanning, exploração, teste de penetração, stress test, teste de exaustão ou aumento além dos limites acordados.
- Gerar pagamentos reais, enviar mensagens reais, contactar provedores, emitir emails/SMS ou executar webhooks reais.
- Migrar a base de dados produtiva, consultar bases existentes, carregar dados reais ou apagar qualquer base.
- Corrigir automaticamente bugs, achados ZAP ou avisos de desempenho; esses itens serão apresentados para decisão posterior.
- Instalar k6 ou ZAP sem autorização explícita posterior caso não sejam encontrados localmente.

## Critérios de aceitação

1. O preflight prova que servidor e PostgreSQL pertencem à nova instância local descartável, com PostgreSQL 18, sem assumir ou usar a porta 3000 nem a `DATABASE_URL` existente.
2. Todos os testes E2E existentes são executados ou têm motivo explícito e seguro para bloqueio; nenhum é removido ou silenciado.
3. A matriz Newman contabiliza todas as rotas HTTP reais; cada rota tem cenário seguro ou exclusão justificada, sem assumir que o OpenAPI atual é completo.
4. k6 respeita estritamente os limites de VUs, duração, endpoints somente de leitura e thresholds acordados.
5. ZAP executa apenas baseline passiva, limitada ao localhost.
6. Relatório consolidado registra resultados e limitações sem segredos ou dados pessoais reais.
7. Nenhum teste ou preparação escreve em base existente, contata serviço externo ou deixa uma alteração destrutiva sem autorização explícita.

## Resposta a falhas

Quando houver falha de teste ou achado:

1. Capturar evidência sanitizada e classificar como defeito reproduzível, limitação/fixture, indisponibilidade da ferramenta ou achado a validar.
2. Não enfraquecer/remover testes e não alterar comportamento de produção nesta campanha.
3. Parar a fase se o alvo/scope de segurança não puder ser garantido.
4. Entregar o relatório e pedir aprovação específica para cada correção ou teste adicional que expanda os limites.
