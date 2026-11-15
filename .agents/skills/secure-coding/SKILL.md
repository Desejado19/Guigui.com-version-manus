---
name: secure-coding
description: Praticas de codigo seguro aplicadas a este repositorio — validacao de entrada, manuseamento de dinheiro, bilhetes e sessoes. Usar ao escrever qualquer rota, caso de uso ou componente que receba dados do utilizador.
---

# Codigo seguro — Guigui.com

## Entrada

1. **Validar na fronteira**: a rota valida o corpo antes de chamar o caso de uso (`server/validationService.ts`).
2. **Allowlist, nao blocklist**: aceitar os campos e valores conhecidos; rejeitar o resto.
3. **Limites**: tamanho de texto, numero de itens, quantidade de bilhetes, ficheiros por publicacao.
4. **Tipos**: converter e validar (`Number.isFinite`, `Date.parse`), nunca confiar no tipo do JSON.

## Dinheiro e bilhetes

- Valores em inteiros XOF; recalcular sempre no servidor (preco nunca vem do cliente).
- Taxas e comissoes vem do catalogo; o cliente so mostra.
- Emissao de bilhete em transacao, com stock verificado e chave de idempotencia.
- Validacao na porta: um bilhete usado nao volta a passar; registar tentativa falhada.

## Sessoes

- Cookie httpOnly, `SameSite=Lax` (ou `Strict`), `Secure` em producao.
- Regenerar sessao no login; expirar por inatividade.
- Comparacoes de token em tempo constante quando aplicavel.

## Ficheiros e uploads

- Validar tipo real (nao so extensao), limitar tamanho, gerar nome proprio.
- Nunca servir uploads com `Content-Type` vindo do cliente.
- Guardar fora da raiz servida estaticamente quando possivel.

## Erros e logs

- Log estruturado com `requestId`, rota, estado e duracao.
- Nunca logar: password, token de sessao, chave de API, PIN de bilhete, numero completo de telefone.
- Erro para o utilizador: mensagem clara e curta; detalhe tecnico so no servidor.

## Checklist

- [ ] Todos os campos validados e limitados?
- [ ] Preco/limite recalculados no servidor?
- [ ] Operacao composta em transacao?
- [ ] Erro nao vaza detalhe interno?
- [ ] Nenhum segredo em codigo, log ou resposta?
