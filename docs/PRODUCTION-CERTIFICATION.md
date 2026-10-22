# Certificação de prontidão para produção

Data da avaliação: 2026-09-05  
Versão: working tree local (sem commit/tag de release fornecido)  
Ambiente: desenvolvimento local com PostgreSQL 17; integrações Orange Money,
Telecel e SMS permanecem sandbox/simuladas.

## Decisão

**BLOQUEADO ATÉ CORREÇÃO.**

Não foram encontradas vulnerabilidades npm moderadas ou superiores e os fluxos
críticos automatizados passam. A restauração integral e um smoke load controlado
foram confirmados. Ainda faltam stress/soak em staging, rollback executado,
monitorização externa e aprovações operacionais/jurídicas.

## Entregáveis e estado

| Entregável | Estado | Evidência ou lacuna |
| --- | --- | --- |
| Relatório executivo | Aprovado com risco | Este documento |
| Relatório técnico de segurança | Aprovado com risco | `npm audit`, headers, MFA, rate limit e RBAC implementados |
| Relatório de testes de carga | Aprovado com risco | Smoke load local confirmado; stress/soak de staging pendentes |
| Relatório de recuperação de desastre | Aprovado com risco | Restauração integral confirmada em base isolada |
| Matriz de riscos | Aprovado com risco | Secção abaixo |
| Inventário de dados pessoais | Aprovado com risco | Secção abaixo; retenção jurídica precisa de decisão formal |
| Plano de lançamento | Aprovado com risco | Secção abaixo |
| Plano de rollback | Aprovado com risco | `docs/OPERATIONS.md`; ainda não executado em staging |
| Runbooks operacionais | Aprovado com risco | `docs/OPERATIONS.md` e `docs/RUNBOOKS.md` |
| Matriz de responsabilidades | Aprovado com risco | Secção abaixo; nomes reais ainda devem ser atribuídos |
| Lista de pendências | Aprovado | Secção abaixo |
| Registo de evidências | Aprovado | Secção abaixo |
| Relatório pós-lançamento | Não aplicável | Deve ser produzido após o go-live |

## Inventário de dados

| Dado | Origem | Finalidade | Acesso | Proteção e retenção |
| --- | --- | --- | --- | --- |
| Nome | Registo de conta/compra | Identidade e titularidade | Utilizador, suporte autorizado | Sessão protegida; retenção deve seguir política legal |
| E-mail | Registo de conta | Login e comunicação | Utilizador e serviços autorizados | Hash de sessão; eliminação mediante pedido quando legalmente possível |
| Telefone | Registo/compra | Contacto e bilhete | Utilizador, empresa do evento | Normalizado; SMS atual é simulado |
| Localização | Perfil/empresa | Diretório e descoberta | Público conforme publicação | Minimização e revisão de retenção |
| Compras e pagamentos | Checkout/provedores | Emissão, reconciliação e auditoria | Financeiro/admin autorizado | PostgreSQL, auditoria e retenção legal; não apagar sem análise jurídica |
| Logs | API e auditoria | Segurança, suporte e diagnóstico | Operação restrita | Sem segredos intencionais; definir prazo e acesso em produção |

## Matriz de riscos

| ID | Risco | Severidade | Probabilidade | Impacto | Mitigação | Responsável | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | Ausência de teste de carga em staging | Alto | Média | Degradação sob pico | Criar cenário baseado em tráfego real anonimizado e repetir | SRE | Aberto |
| R-002 | Restauração integral não confirmada | Alto | Baixa | RTO/RPO não comprovados | Restaurar dump numa base isolada e validar contagens/fluxos | DBA | Aberto |
| R-003 | Rollback não executado | Alto | Média | Recuperação de deploy incerta | Testar rollback de aplicação e migração aditiva em staging | DevOps | Aberto |
| R-004 | Integrações externas em sandbox | Médio | Média | Comportamento de produção desconhecido | Validar credenciais reais em janela controlada, sem dados reais | Produto/Finanças | Aberto |
| R-005 | Ausência de Prometheus/Grafana externos | Médio | Média | Alertas podem não chegar à equipa | Provisionar monitorização e alertas com responsáveis | SRE | Aberto |
| R-006 | Retenção jurídica não formalizada | Médio | Média | Risco de conformidade | Aprovação jurídica de prazos, anonimização e pedidos RGPD | DPO | Aberto |

## Registo de evidências

| Teste | Ambiente | Data | Resultado | Evidência |
| --- | --- | --- | --- | --- |
| Typecheck | Local | 2026-09-05 | Passou | `npm run check` |
| Build | Local | 2026-09-05 | Passou | `npm run build` |
| Dependências | Local | 2026-09-05 | Passou | `npm audit --omit=dev --audit-level=moderate`: 0 |
| Pagamentos | Local/sandbox | 2026-09-05 | Passou | `npm run test:payments` |
| Bilhetes | Local/PostgreSQL | 2026-09-05 | Passou | `npm run test:tickets` |
| Interface | Local | 2026-09-05 | Passou | `npm run test:e2e`: 2 testes |
| Prometheus | Local | 2026-09-05 | Passou | `/metrics`: 200, `text/plain`, métrica presente |
| Backup PostgreSQL | Base isolada | 2026-09-05 | Passou | `pg_restore` e contagens: users=1, tickets=74, payment_transactions=47, audit_logs=121 |
| Smoke load | Local | 2026-09-05 | Passou | 100 requests, concurrency 10, 0 erros, p50 12,77 ms, p95 211,96 ms, p99 238,25 ms |
| Carga/stress/soak | Staging | — | Não testado | Ambiente e carga de referência ainda não definidos |
| Rollback | Staging | — | Não testado | Procedimento documentado, execução pendente |

## Plano de lançamento e critérios de pausa

Staging e smoke tests devem preceder aprovação técnica e de negócio. O rollout
deve começar com uma percentagem pequena, aumentar gradualmente e manter
monitorização intensiva. Pausar ou reverter se houver aumento sustentado de
erros HTTP, falhas de pagamento, bilhetes inválidos, perda de jobs ou latência
acima do limite aprovado antes do teste.

## Responsabilidades

| Área | Responsável funcional | Backup |
| --- | --- | --- |
| Segurança e incidentes | Atribuir Security Owner | Atribuir |
| PostgreSQL e recuperação | Atribuir DBA | Atribuir |
| Deploy e rollback | Atribuir DevOps | Atribuir |
| Produto e pagamentos | Atribuir Product/Finance Owner | Atribuir |
| Suporte e comunicação | Atribuir Support Lead | Atribuir |

## Pendências bloqueadoras

1. Criar staging semelhante à produção e executar carga normal, pico, stress,
   soak e recuperação após saturação.
2. Executar rollback real de aplicação e validar compatibilidade da migração.
3. Provisionar alertas externos e atribuir responsáveis/canais.
4. Obter aprovação jurídica da política de privacidade, retenção e incidentes.
