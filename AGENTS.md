# Instruções do projeto

## Planear antes de executar

- Todo e qualquer pedido — código, correções, auditorias, testes, alterações de dados ou configuração — começa obrigatoriamente por um **plano escrito**.
- O plano deve indicar, antes de qualquer alteração:
  1. **Objetivo** e critérios de conclusão.
  2. **Âmbito**: o que entra e o que fica explicitamente de fora.
  3. **Ficheiros/áreas** que serão tocados.
  4. **Passos ordenados**, com dependências.
  5. **Verificação** prevista (comando, teste ou evidência) para cada passo.
  6. **Riscos e proteções** (dados, servidor, reversibilidade).
- Só depois de o plano estar apresentado se executa. Desvios ao plano devem ser explicados antes de continuar.
- Pedidos destrutivos, irreversíveis ou que alterem dados fora do âmbito do plano exigem confirmação explícita.
- Correções de bugs devem indicar a causa provável e o teste que prova a correção; não se altera código "a ver se resolve".
