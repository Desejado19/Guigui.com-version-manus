# Instruções do projeto (Guigui.com)

## Fluxo obrigatório para cada pedido

Nenhum pedido é implementado à primeira. A ordem é sempre:

1. **Analisar** o pedido e o código relevante: ficheiros envolvidos, comportamento atual, dados/RLS existentes, riscos e o que já existe para reutilizar.
2. **Apresentar um plano de implementação** antes de qualquer alteração de código:
   - objetivo em uma frase;
   - passos numerados e ordem;
   - ficheiros a criar/alterar;
   - testes e verificações que serão executados;
   - riscos, limitações e decisões assumidas.
3. **Só depois implementar tudo** o que o plano cobre — de forma completa, sem deixar partes para "uma segunda fase" não pedida.
4. **Executar tudo**: typecheck, testes relevantes, build e reinício/verificação ao vivo quando a alteração afecta o runtime. Reportar o que passou, o que falhou e o que não foi possível verificar.

Se o pedido for apenas uma pergunta ou uma explicação, o plano pode resumir-se a uma linha e não há alterações de código.

## Regras permanentes

- Responder em português (PT-PT).
- Nunca imprimir segredos (chaves, tokens, passwords) no chat, em logs ou em ficheiros versionados.
- Preservar dados existentes; não desactivar RLS nem introduzir dados simulados em produção.
- Reutilizar o que o projeto já tem antes de criar duplicados (ex.: validação de email em `shared/emailAddress.ts`, configuração em `server/email/config.ts`).
- Validar no servidor; o browser é apenas UX.
- Manter `tsc --noEmit` e os testes verdes; não enfraquecer asserções para passar.
- Alterações ao runtime exigem `npm run build` e reinício do servidor de produção local (`node scripts/start-production.mjs`).

## Comandos úteis

- `npx tsc --noEmit` — typecheck.
- `npx vitest run <ficheiros>` — testes focados.
- `npm run build` — build de produção.
- `npm run email:check` — valida a configuração de email e a chave Brevo sem enviar emails.
