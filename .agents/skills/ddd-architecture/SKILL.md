---
name: ddd-architecture
description: Modelacao por dominio no Guigui.com, com aggregate roots, casos de uso e politicas configuraveis. Usar ao implementar compra de bilhetes, planos SaaS, moderacao, monetizacao ou qualquer regra que o administrador deva poder configurar.
---

# Domain-Driven Design — Guigui.com

## Onde vive o dominio

```
server/modules/platform-foundation/   # modulos de dominio
server/ticketPurchaseDomain.ts        # entidades e invariantes de bilhetes
server/ticketPurchasePorts.ts         # portas (interfaces)
server/ticketPurchaseUseCase.ts       # caso de uso
server/postgresTicketService.ts       # adaptador
```

O padrao a copiar e o de bilhetes: **dominio puro**, **porta**, **caso de uso**, **adaptador**.

## Regras

1. **O administrador define as politicas; o codigo aplica-as.** Limites, precos, comissoes, funcionalidades por plano e regras de expiracao vivem em dados, nao em `if`.
   - Proibido: `if (plan === 'PREMIUM')`.
   - Correto: `resolvePlan()`, `planIncludesFeature()`, `featuresForPlan()` em `src/services/entitlementService.ts`.
2. **Invariantes no dominio, nao na UI.** Ex.: nao vender mais bilhetes do que o stock; nao usar um bilhete duas vezes; nao reescrever contrato ja pago.
3. **Caso de uso devolve resultado tipado** (sucesso com dados, ou erro com codigo). A rota traduz para HTTP; a UI traduz para mensagem.
4. **Portas antes de adaptadores.** Novo armazenamento = nova implementacao da porta, sem tocar no caso de uso.
5. **Linguagem ubiqua em portugues** nos nomes de dominio (`bilhete`, `promocao`, `moderacao`, `plano`, `assinatura`), consistente com `src/types.ts`.
6. **Versionamento de politicas.** Alterar um plano cria versao nova (`SubscriptionPlanVersion`); assinaturas existentes mantem a fotografia contratada.

## Checklist

- [ ] A regra esta num caso de uso ou funcao de dominio, nao na rota nem no componente?
- [ ] O valor configuravel (preco, limite, prazo) vem de dados?
- [ ] Ha teste que prove a invariante (stock, dupla utilizacao, permissao)?
- [ ] O erro tem codigo estavel, nao mensagem de texto solta?
- [ ] A alteracao cria versao quando muda contrato comercial?

## Comandos

```bash
npm run test:tickets        # validacao e fluxo de bilhetes
npm run test:subscriptions  # planos e assinaturas
npm run test:monetization   # catalogo e motor de monetizacao
npm run test:moderation     # pipeline de moderacao
```
