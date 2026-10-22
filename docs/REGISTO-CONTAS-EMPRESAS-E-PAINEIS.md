# Registo de contas e empresas — fluxo final

## Comportamento implementado

O registo de cidadão e o registo empresarial passam a criar uma sessão autenticada imediatamente. Assim que o servidor responde com sucesso, a aplicação abre o painel correspondente ao papel da conta:

| Tipo de conta | Papel devolvido | Painel inicial |
|---|---|---|
| Conta pessoal | `user` | Área do Cidadão/Utilizador |
| Conta empresarial | `business` | Painel da Empresa |
| Conta administrativa existente | `admin` | Centro de Administração |

## Registo empresarial

Ao criar uma empresa, o servidor gera um `businessId` novo e não aceita o `businessId` enviado pelo navegador. A conta empresarial é associada a esse identificador e a empresa é criada com estado `pending`, aguardando a validação administrativa.

Com PostgreSQL configurado, são persistidos:

1. o registo em `companies`;
2. o utilizador em `users`;
3. a associação de proprietário/manager em `company_members`;
4. a sessão autenticada.

No modo local sem PostgreSQL, o mesmo fluxo usa o armazenamento persistente JSON do servidor e mantém a associação entre conta e empresa.

## Registo de cidadão

O cidadão é gravado em `users` — ou no armazenamento local equivalente — e recebe sessão autenticada. A aplicação inicia directamente na área pessoal, sem obrigar a novo login.

## Segurança

O identificador empresarial fornecido pelo cliente é ignorado no registo público. Isto impede que uma pessoa tente associar a sua conta a uma empresa já existente. A empresa recebe sempre um identificador novo gerado no servidor.

## Validação realizada

- TypeScript: passou.
- Suite unitária: **238 testes passaram; 19 ignorados**.
- Build frontend/backend: passou.
- Smoke real: registo de cidadão e empresa responderam `201`.
- Sessão real: ambos os registos devolveram `authenticated: true`.
- Empresa real: recebeu `role: business`, `businessId` novo e empresa em estado `pending`.
