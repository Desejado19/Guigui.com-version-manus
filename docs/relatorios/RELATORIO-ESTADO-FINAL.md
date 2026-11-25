# Guigui.com — Relatório de Estado Final

**Documento de referência:** Escopo Técnico e Funcional v1.0 — Grupo Gorila (Julho 2026)
**Data da verificação:** 28 de Setembro de 2026
**Âmbito desta verificação:** Secções 3 a 13 do documento de escopo.

Este relatório distingue três situações que costumam ser confundidas: o que está
**construído e verificado**, o que está **construído mas depende de acção
externa**, e o que **não foi construído**. A Secção 3.12 do escopo só pode ser
assinada com base nesta distinção.

---

## 1. Estado de validação técnica

| Verificação | Resultado |
|---|---|
| Compilação TypeScript (`tsc --noEmit`) | **0 erros** |
| Testes automatizados | **224 aprovados**, 19 ignorados, 18 ficheiros |
| Build de produção | Concluído, sem erros |
| Validação em servidor real | Efectuada com PostgreSQL ligado |

A validação em servidor real foi feita contra a base de dados configurada, não
apenas com testes de unidade. Incluiu compra de bilhete, cancelamento,
reembolso, confirmação de reembolso, manifesto offline do scanner, detecção de
duplicação entre terminais e verificação de isolamento entre utilizadores.

---

## 2. Construído e verificado

### 2.1 Infra-estrutura
- React 19 + Vite + Tailwind 4 (frontend), Express + TypeScript (backend), PostgreSQL com fallback JSON
- 42 tabelas com chaves estrangeiras, índices e restrições
- PWA instalável, responsivo para 3G/4G
- 5 idiomas: Português, Crioulo (Kriyol), Francês, Inglês, Espanhol

### 2.2 Autenticação e segurança
- Palavras-passe com scrypt + salt; sessões com token HMAC-SHA256
- Cookie HttpOnly, SameSite e Secure em produção
- CSP, HSTS, CORS restrito, rate-limit distribuído
- Registo de auditoria em todas as acções sensíveis
- Conformidade legal: consentimento registado com IP e timestamp

### 2.3 Bilhética (§ 7)
- Compra sem registo prévio, com titular por bilhete
- QR Code, token único assinado e PIN de 4 dígitos
- Anti-reutilização verificada: a segunda leitura é rejeitada
- Scanner de porta com validação online e verificação manual por PIN
- **Modo offline (§ 7.2)**: manifesto assinado descarregado antecipadamente,
  validação local, fila de sincronização e **detecção de duplicação entre
  terminais** — validado ao vivo
- **Cancelamento (§ 7.4.10)**: comprador, empresa organizadora e administração
- **Reembolso (§ 7.4.11)**: exclusivo da empresa organizadora, com ciclo completo
  `requested` → `processed`

### 2.4 Avaliações (§ 8)
Escala de 4 níveis com pesos internos 1–4. O público vê apenas o rótulo
qualitativo predominante, nunca média numérica nem estrelas. Anti-abuso por
telemóvel com janela de 90 dias, mascaramento do número, moderação, denúncia e
resposta pública do negócio.

### 2.5 Operação
- **Backup real**: `pg_dump` com cifragem AES-256-GCM, réplica externa verificada
  por SHA-256, agendamento configurável, retenção automática e manifesto
- **Restauração verificada**: o ficheiro cifrado foi decifrado e o `pg_restore`
  leu 206 objectos da base — é uma cópia restaurável, não um registo

---

## 3. Construído, mas depende de acção externa

Estas funcionalidades estão **completas em código**. O que falta não é
engenharia — é contrato comercial e credenciais.

| Item | Estado do código | O que falta |
|---|---|---|
| Entrega de SMS (§ 7.1) | Integração completa: modos `live`, `sandbox`, `simulated`, estado de entrega real na resposta | Contrato com a operadora e `GUIGUI_SMS_GATEWAY_URL` / `_KEY` |
| Reembolso automático ao operador | Pedido registado e confirmado; a confirmação manual fecha o ciclo | Endpoint de reembolso da operadora para automatizar |
| Notificações push (§ 11.3) | PWA e centro de notificações funcionais | Chaves VAPID e service worker de push |
| Domínio oficial e HTTPS | Cabeçalhos de produção prontos | Publicação e registo do domínio |

**Importante:** sem credenciais, o sistema assume o modo `simulated` e **declara
que o SMS não foi entregue**. Nunca afirma uma entrega que não aconteceu.

---

## 4. Não construído — aguarda decisão do Grupo Gorila

Estas lacunas exigem resposta de negócio ou jurídica. Nenhuma é um bug.

| # | Item | Porquê precisa de decisão |
|---|---|---|
| 4.1 | **Reembolso em massa com notificação aos compradores** (§ 7.3) | Definir o canal da notificação (SMS, email ou in-app) e o que acontece a compradores fora da janela de retenção |
| 4.2 | **Retenção de receita ao organizador** (§ 7.3, ref. 7 dias úteis) | Confirmar o prazo e designar quem executa a transferência |
| 4.3 | **Facturas descarregáveis** (§ 6.2) | Definir se é documento fiscal da Guiné-Bissau ou comprovativo interno — tem implicações legais |
| 4.4 | **Dados demográficos agregados** nos escalões superiores (§ 6.2) | Requer a definição do pacote de dados agregados |

---

## 5. Fora do âmbito por decisão do próprio documento

Não são falhas. O escopo exclui ou adia expressamente:

- Venda de produtos e serviços dos negócios listados
- Gestão de entregas
- Intermediação de pagamentos entre negócios e público
- Directório impresso anual e API para terceiros (§ 4.3, Fase 4)

---

## 6. Defeitos encontrados e corrigidos durante a auditoria

A verificação não confirmou apenas o que funcionava. Identificou e corrigiu
falhas com impacto real:

| Severidade | Defeito | Impacto |
|---|---|---|
| **Crítica** | Registo público aceitava `businessId` arbitrário | Qualquer visitante anónimo criava conta e tornava-se **gestor de qualquer empresa** |
| **Crítica** | Violação de chave estrangeira não tratada no registo | Um único pedido anónimo **derrubava o servidor inteiro** |
| **Alta** | `POST /api/businesses`, `/api/events` e `/api/app-state` sem autenticação | Escrita anónima na base de dados |
| **Alta** | Estado de plataforma gravado como array do cliente | Empresa autenticada podia **apagar concorrentes e reescrever preços** |
| **Média** | Botão de modo offline sem capacidade correspondente | Prometia uma funcionalidade inexistente |
| **Média** | Endpoint declarava 3 idiomas | O sistema tem 5 |
| **Média** | Backup declarava 846 MB inventados | Registava cópias que nunca fez |
| **Baixa** | Máscara de telemóvel mostrava `+245 245` | Prefixo do país contado como número do assinante |

Cada correcção tem teste de regressão que **foi verificado falhar** contra o
código vulnerável antes de ser considerado válido.

### 6.1 Nota de integridade

Durante uma das correcções, uma reescrita de ficheiro com ferramentas do sistema
operacional corrompeu a codificação de 629 caracteres acentuados em `server.ts`.
O dano foi detectado, reparado e verificado (0 ocorrências restantes). O ficheiro
compila e os testes passam. Regista-se aqui para transparência.

---

## 7. Conclusão sobre a Secção 3.12

O critério de conclusão da Secção 3.12 **não pode ser assinado ainda**, por três
razões verificáveis:

1. **Dois requisitos da § 7.3 estão por construir** (itens 4.1 e 4.2 acima) e
   dependem de decisão de negócio.
2. **As integrações das operadoras dependem de contrato comercial** — a
   engenharia está pronta, mas sem contrato o sistema opera em modo `simulated`
   declarado.
3. **A conformidade legal do § 13 tem requisitos que não são exclusivamente
   técnicos**, nomeadamente a natureza do documento de factura.

O que **está** verificado e demonstrável: arquitectura, área pública, áreas de
cliente e administração, autenticação, permissões, base de dados, bilhética com
anti-fraude, avaliações, moderação, comunicação persistente, cinco idiomas, PWA e
backup cifrado e restaurável.

