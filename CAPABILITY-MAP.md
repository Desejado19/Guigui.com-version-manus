# Mapa de capacidades: migração do backend Guigui.com

**Estado:** mapa de módulos e dependências aprovado pelo utilizador  
**Data:** 2026-10-22  
**Iniciativa:** monólito modular com DDD pragmático

Os módulos são fronteiras de propriedade dentro de um único processo Express. As dependências abaixo representam contratos publicados e ordem de composição, não autorização para importar modelos, serviços ou persistência internos de outro módulo.

| ID do módulo | Responsabilidade | Dependências de composição |
|---|---|---|
| `platform-foundation` | Inicialização, configuração, saúde, observabilidade e contratos técnicos comuns | — |
| `identity-access` | Contas, credenciais, sessões, autenticação e autorização | `platform-foundation` |
| `business-discovery` | Empresas, diretório, feed, ofertas e avaliações | `platform-foundation`, `identity-access` |
| `payments-monetization` | Pagamentos, subscrições, catálogo comercial, taxas, reconciliação e reembolsos | `platform-foundation`, `identity-access` |
| `events-ticketing` | Eventos, inventário, reservas, emissão de bilhetes, acesso e scanner | `platform-foundation`, `identity-access`, `business-discovery`, `payments-monetization` |
| `communication-support` | Conversas, mensagens, suporte e notificações | `platform-foundation`, `identity-access`; contratos de outros contextos apenas quando necessários |
| `governance-operations` | Moderação, denúncias, auditoria e operações/relatórios administrativos | `platform-foundation`, `identity-access`; contratos dos contextos operacionais quando necessários |

## Ordem de evolução

1. `platform-foundation` — completar e estabilizar o que já foi extraído.
2. `identity-access` — completar a extração parcial existente.
3. `business-discovery`.
4. `payments-monetization`.
5. `events-ticketing` — integrar o caso de uso de compra de bilhetes já extraído.
6. `communication-support`.
7. `governance-operations`.

O levantamento e a linha de base de compatibilidade precedem cada contexto. A ordem não autoriza uma migração em bloco: cada módulo tem especificação, validação e aprovação próprias antes da implementação.

## Regras de dependência

- Não criar ciclos entre módulos.
- Comunicação e governança integram outros contextos por contratos publicados, apenas quando a necessidade estiver definida na especificação do respetivo módulo.
- Os consumidores usam IDs, DTOs e casos de uso publicados; não consultam tabelas nem escrevem em ficheiros pertencentes a outro contexto.
- A composição e a execução continuam num único processo. Este mapa não propõe microserviços.

## Fonte de verdade

Este é o mapa canónico da iniciativa. A especificação geral encontra-se em [`docs/superpowers/specs/2026-10-22-guigui-modular-ddd-migration-design.md`](docs/superpowers/specs/2026-10-22-guigui-modular-ddd-migration-design.md) e foi aprovada integralmente pelo utilizador em 2026-10-23, juntamente com o roadmap.
