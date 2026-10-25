# Especificação: persistência durável PostgreSQL para o Guigui.com

**Estado:** rascunho para revisão do utilizador  
**Data:** 2026-10-25  
**Escopo:** tornar PostgreSQL a fonte durável dos dados próprios da aplicação, com migração gradual pelos sete contextos DDD  
**Compatibilidade:** preservar os contratos e fluxos existentes; não implantar nem alterar o Render nesta iniciativa

Esta especificação é a política de persistência de produção para o sistema inteiro. Onde especificações anteriores permitirem fallback local sem `DATABASE_URL`, essa compatibilidade aplica-se apenas a desenvolvimento/testes; não prevalece sobre o requisito de PostgreSQL obrigatório em produção.

## Objetivo

Garantir que os dados próprios e duráveis do Guigui.com sobrevivem a reinícios, novos processos e deploys. Em produção, PostgreSQL será a fonte de verdade; uma falha ou ausência do banco não poderá ser mascarada por dados locais nem produzir uma resposta de sucesso sem persistência confirmada.

A migração será incremental, dentro do monólito Express existente, seguindo o ownership e a ordem de [`CAPABILITY-MAP.md`](../../../CAPABILITY-MAP.md). Não se trata de converter o sistema em microserviços nem de migrar todos os contextos num único corte.

## Entendimento aprovado

- Todos os dados duráveis próprios dos sete contextos devem ser persistidos em PostgreSQL.
- PostgreSQL é obrigatório em produção. Se a configuração ou a conexão estiver ausente no arranque, a aplicação não deve iniciar como saudável; se a ligação cair depois do arranque, readiness deve falhar e as operações dependentes do banco devem devolver erros explícitos.
- JSON e `localStorage` não são fallback de produção. Adaptadores locais podem continuar em desenvolvimento/testes enquanto forem necessários, sem mudar a semântica de produção.
- Configuração, segredos, código, traduções estáticas, assets binários e estado transitório/reconstruível da interface não são linhas de negócio PostgreSQL.
- Catálogos editáveis ficam no banco. Conteúdo ou configuração estática pertencente ao código pode continuar versionada com o código.
- Cada contexto é dono do seu schema/repositórios. Consumidores usam IDs, DTOs e casos de uso publicados; não leem nem escrevem tabelas internas de outro contexto.
- Tabelas relacionais são o padrão. `JSONB` é permitido para payloads variáveis com contrato/versionamento explícito, não como armazenamento genérico de todo o sistema.
- Migrations de schema são explícitas e executadas fora do arranque normal do serviço.
- Não haverá dual-write. Para manter consistência durante a importação e o corte, cada contexto poderá ter uma janela curta de manutenção/somente leitura: congelar gravações, importar, reconciliar e então ativar a fonte PostgreSQL.
- Dados elegíveis existentes apenas no `localStorage` poderão ser transferidos por um fluxo temporário autenticado, com pré-visualização e confirmação do utilizador. O servidor não lerá dados de navegadores sem essa transferência.
- Não se acede, migra ou altera dados reais de produção sem autorização específica. Testes e validações usarão dados sintéticos e uma base isolada.

## Contexto observado

O inventário estático de persistência de 2026-10-24 encontrou fontes de dados distribuídas por PostgreSQL, arquivos JSON, `localStorage`, memória de processo e estado derivado no browser. Existem migrations e serviços PostgreSQL para alguns fluxos, mas a presença de tabela ou endpoint isolado não prova que leitura, escrita, importação e falhas estejam coerentes.

Exemplos de lacunas já identificadas no inventário:

- identidade combina repositórios PostgreSQL e JSON para diferentes dados, incluindo sessões, convites ou recuperação;
- negócios e eventos misturam tabelas PostgreSQL, estado de browser e exemplos estáticos;
- há serviços de pagamentos e monetização fora de um contexto completo;
- compra de bilhetes tem caso de uso extraído, mas parte do domínio continua fora do módulo;
- mensagens, suporte e notificações têm estado local/JSON em partes dos fluxos;
- moderação usa uma coluna `item_data` que não foi encontrada nas migrations observadas, e alguns caminhos podem recorrer a JSON;
- denúncias de avaliações, consentimentos e histórico de backups não têm cobertura relacional completa;
- auditoria PostgreSQL não preenche todos os campos relacionais de atribuição presentes no schema;
- relatórios administrativos são calculados no browser e são derivados, salvo decisão futura de guardar execuções;
- backups são ficheiros operacionais, enquanto o histórico de execuções está em JSON; bytes de backup não devem ser armazenados em tabelas de negócio.

Estes pontos são evidência para planeamento, não autorização para corrigir em bloco. Os detalhes e as validações propostas estão em [`docs/superpowers/reports/2026-10-24-guigui-persistence-inventory.md`](../reports/2026-10-24-guigui-persistence-inventory.md).

## Abordagens consideradas

1. **Migração incremental por contexto DDD — escolhida.** Mantém o monólito, preserva os contratos e permite provar cada corte com fixtures, testes de falha e reconciliação antes de avançar.
2. **Tabela genérica `app_state` em JSONB para todo o produto.** Menor alteração inicial, mas enfraquece relações, constraints, ownership, consultas, auditoria e migrações; não foi escolhida como modelo final.
3. **Migração simultânea de todos os domínios.** Reduz o período de coexistência dos adaptadores, mas amplia o risco de perda e torna o diagnóstico/rollback difíceis; não foi escolhida.

## Escopo por contexto

O recenseamento final de entidades e campos será validado contra o inventário e o código antes de cada implementação. O alvo inclui, no mínimo:

| Contexto | Dados duráveis abrangidos |
|---|---|
| `platform-foundation` | Jobs duráveis, buckets de rate limit partilhados, eventos e métricas operacionais cuja retenção for aprovada, além do estado/configuração de observabilidade que precisa sobreviver a reinícios. Health/readiness continuam derivados. |
| `identity-access` | Contas, credenciais e respetivos metadados, MFA/recuperação, sessões, convites, permissões, consentimentos e preferências associadas ao utilizador. Segredos de autenticação devem permanecer cifrados/hasheados conforme o tipo. |
| `business-discovery` | Empresas, perfis, categorias editáveis, ofertas, conteúdo/feed persistente, avaliações, favoritos e relações de descoberta que o produto mantém entre sessões. |
| `payments-monetization` | Catálogo comercial editável, subscrições, taxas, transações, reconciliação e reembolsos; integrações permanecem simuladas até aprovação própria. |
| `events-ticketing` | Eventos, inventário, reservas, pedidos, emissão/validação de bilhetes, estados de scanner e lembretes persistentes necessários ao fluxo. |
| `communication-support` | Conversas, mensagens, suporte, notificações e preferências de notificação com histórico necessário ao produto. |
| `governance-operations` | Moderação e respetivo histórico, denúncias individualizadas, auditoria atribuída, operações administrativas e consentimento se o ownership final assim o determinar por contrato publicado. |

Os binários (por exemplo, imagens e ficheiros de backup) ficam num armazenamento de ficheiros durável adequado, com metadados, propriedade e referências no PostgreSQL quando necessário. Relatórios calculados continuam derivados das fontes autoritativas; persistir snapshots de relatórios exige requisito próprio. Métricas efémeras de processo não se tornam dados de negócio por estarem num endpoint.

## Arquitetura e comportamento

### Produção e disponibilidade

- O carregamento de configuração valida `DATABASE_URL` em produção sem revelar a URL nos logs.
- A aplicação verifica a conexão PostgreSQL antes de anunciar readiness. Ausência de configuração ou conexão torna o processo indisponível para tráfego normal; não ativa adaptador JSON.
- Após o arranque, falhas de conexão são expostas como falhas de disponibilidade. Nenhuma operação de escrita responde sucesso antes da confirmação do commit PostgreSQL.
- Respostas e erros preservam os contratos HTTP existentes sempre que possível; novos códigos de erro são estáveis e testados.
- O modo local/teste pode usar adaptadores não PostgreSQL apenas fora de produção e explicitamente selecionados.

### Ownership e schema

- Cada contexto expõe composição, portas e adaptadores sob o seu diretório de módulo.
- O schema é relacional por padrão, com constraints, índices, timestamps e chaves de ownership definidos pelo domínio.
- Payloads `JSONB` têm proprietário e versão documentados e não substituem campos que exigem consultas, constraints, autorização ou reconciliação.
- Integrações entre contextos ocorrem por contratos publicados. Transações ficam dentro de um contexto; não se introduzem transações distribuídas ou infraestrutura genérica de eventos nesta especificação.
- Catálogos de referência são carregados por seeds idempotentes de IDs próprios. Seeds não apagam nem alteram linhas alheias.

### Migração de dados existentes

1. Para cada contexto, identificar todas as fontes, entidades, campos, IDs e regras de compatibilidade antes de tocar nos dados.
2. Criar migration aditiva e importador específico e idempotente; produzir um modo de pré-visualização com contagens, colisões e rejeições.
3. Testar o importador e a reconciliação em PostgreSQL sintético descartável; preservar identificadores sempre que possível e falhar explicitamente em conflitos não resolvidos.
4. No corte autorizado, congelar temporariamente as gravações daquele contexto, preservar a fonte anterior sem a apagar, importar, validar invariantes e contagens, ativar PostgreSQL e reabrir gravações.
5. Depois do corte, não manter gravação paralela nem fallback automático. O padrão é corrigir para a frente; reverter código exige compatibilidade com os dados já gravados. Restaurar um backup anterior ao corte, o que pode eliminar gravações posteriores, exige aprovação explícita e plano de reconciliação antes de qualquer ação.
6. Para dados elegíveis no browser, a aplicação oferece fluxo temporário autenticado de exportação/transferência com prévia, validação de ownership, confirmação e idempotência. Dados inválidos ou de propriedade ambígua são apresentados para decisão, não atribuídos automaticamente.
7. A importação de produção, remoção/expurgo de fontes antigas e quaisquer alterações em dados reais exigem aprovação explícita específica e backup verificado.

Migrations e importadores não executam automaticamente no `start` da aplicação. O mecanismo final de execução, privilégio e observabilidade de migrations será definido no plano de implementação.

## Ordem de implementação

Seguir a sequência canónica de [`CAPABILITY-MAP.md`](../../../CAPABILITY-MAP.md):

1. `platform-foundation`;
2. `identity-access`;
3. `business-discovery`;
4. `payments-monetization`;
5. `events-ticketing`;
6. `communication-support`;
7. `governance-operations`.

Antes de uma fatia, reconciliar o inventário do contexto com a implementação e obter aprovação específica do desenho/plano contextual quando faltante ou materialmente desatualizado. Não iniciar um contexto dependente enquanto os contratos e testes do anterior não forem verificados.

## Segurança e recuperação

- Restringir credenciais e permissões de banco pelo princípio do menor privilégio; nunca registar `DATABASE_URL`, segredos, credenciais ou conteúdo sensível.
- Aplicar autorização por utilizador/empresa e ownership nos casos de uso e repositórios; não confiar em IDs enviados pelo cliente sem validação.
- Definir retenção, minimização e acesso para sessões, consentimentos, mensagens, auditoria, moderação e telemetria antes do cutover de cada contexto.
- Manter backups cifrados fora do processo e verificar restauração num banco isolado. `completed` só é emitido quando o artefacto esperado foi verificado; snapshot JSON não substitui backup PostgreSQL de produção.
- Nenhuma chamada a fornecedor real, migração de produção, criação de recurso pago ou deploy faz parte desta especificação.

## Critérios de aceitação

1. Em produção, a aplicação não inicia/declara readiness saudável sem PostgreSQL configurado e acessível e nunca troca para JSON/localStorage silenciosamente.
2. Para cada entidade durável incluída, os casos de uso leem e gravam pelo adaptador proprietário PostgreSQL, com autorização e erro explícito em falha.
3. Um registo sintético criado por cada contexto continua disponível após reiniciar o processo e reconectar a aplicação.
4. Não há duplicação de fonte de verdade entre estado do browser, JSON e PostgreSQL após o corte do contexto; dados locais antigos não reaparecem quando a tabela está vazia.
5. Migrations funcionam numa base vazia e numa base com versão anterior suportada, sem remoção não aprovada; falhas deixam estado diagnosticável e recuperável.
6. Importadores são repetíveis e reconciliam IDs, contagens e relações; não apagam linhas não pertencentes à migração.
7. A transferência de dados de browser é autenticada, revisável pelo utilizador, limitada ao dono dos dados e idempotente.
8. Testes provam indisponibilidade explícita do banco, ausência de fallback de produção, persistência após reinício, autorização, compatibilidade de APIs e reconciliação.
9. Backup e restore são ensaiados em ambiente isolado, com verificação do artefacto cifrado e das relações restauradas.
10. A campanha de QA usa apenas dados sintéticos e ambiente local isolado; fases bloqueadas permanecem bloqueadas, não passam por ausência de resultados.
11. A arquitetura continua monolítica e os limites de dependência de [`CAPABILITY-MAP.md`](../../../CAPABILITY-MAP.md) são respeitados.

## Fora de escopo

- Executar migrations, importar ou alterar bases e ficheiros existentes nesta fase.
- Migrar dados reais ou inspecionar conteúdo de `.env`, snapshots, backups ou armazenamento de utilizadores.
- Fazer deploy, ligar serviço ou configurar recursos no Render ou noutro fornecedor.
- Completar os sete módulos DDD nesta especificação; cada contexto conserva o seu gate de desenho, plano, implementação e verificação.
- Eliminar de uma só vez todos os adaptadores JSON/localStorage antes da validação dos cortes.
- Criar microserviços, dual-write, tabela genérica como fonte universal, chamadas de pagamento reais ou sistema de eventos distribuído.
