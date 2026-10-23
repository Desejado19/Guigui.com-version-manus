# Correr o Guigui.com num caminho sem `#`

## O problema

Este projeto vive dentro de uma pasta com `#` no caminho:

```
C:\Users\PC\Desktop\NEXUS-GW\## SOF\Guigui.com-tema-escuro-testado
```

O **Vite** (servidor de desenvolvimento) e o **Vitest** (testes unitários)
interpretam `#` como fragmento de URL e cortam o caminho. O resultado é que
`npm run test:unit` e `npm run dev` falham neste computador com erros como
`Cannot find module` ou `EISDIR ... read C:/Users/PC/Desktop/NEXUS-GW/`.

Não é um defeito do código: a tipagem (`npm run check`) passa e, num caminho
limpo, os 244 testes unitários e os 30 testes Playwright passam todos. É só o
ambiente.

Junctions (`mklink /J`) e drives virtuais (`subst G:`) **não resolvem**, porque
o Node segue sempre o caminho real, que continua a ter o `#`.

## A solução: `guigui-limpo.cmd`

O script `guigui-limpo.cmd` (na raiz do projeto) sincroniza os fontes para
`C:\guigui` — um caminho curto, sem `#` e sem espaços — e corre o comando lá.

### Como usar

Abre o terminal **nesta pasta** e corre:

```bat
guigui-limpo.cmd check      :: npm run check   (tipagem, tsc)
guigui-limpo.cmd test:unit  :: testes unitários (Vitest)
guigui-limpo.cmd test:e2e   :: testes Playwright (sobe o servidor sozinho)
guigui-limpo.cmd            :: arranca o servidor de desenvolvimento
guigui-limpo.cmd shell      :: só abre um terminal em C:\guigui
```

### O que acontece por dentro

1. **Primeira execução:** copia o `node_modules` (261 MB) para `C:\guigui`. Só
   acontece uma vez.
2. **Todas as execuções:** espelha os fontes (código, testes, configs) com
   `robocopy /MIR`. É rápido — `node_modules` e `.tools` estão excluídos.
3. Entra em `C:\guigui` e corre `npm run <comando>`.

Continuas a editar e a versionar **nesta pasta**. O `C:\guigui` é só uma cópia de
trabalho para correr; podes apagá-la a qualquer momento (é recriada pelo
script).

### Notas

- A fonte é esta pasta (com `#`); o `robocopy` lida bem com `#` na fonte — o
  problema era só do Vite/Vitest a resolver URLs.
- O `.tools` (Node portátil de 125 MB) fica de fora da sincronização porque o
  `start-production.mjs` não depende dele (só importa `dist/server.mjs`).
- Se adicionares dependências novas, corre `guigui-limpo.cmd shell` e faz
  `npm install <pacote>` dentro de `C:\guigui`.
