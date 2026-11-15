# Paleta e padrão de cor do Guigui.com

Documento de referência. Qualquer ecrã novo (site público, painel de empresa, painel
de administração, PDF/XLSX exportado) segue estas regras.

A fonte única de verdade é o bloco `PALETA CANONICA GUIGUI.COM` no topo de
`src/index.css`. Nenhum componente deve escrever um valor de cor literal.

---

## 1. O que a cor tem de comunicar

| Sensação a transmitir | Como se consegue | Onde aparece |
| --- | --- | --- |
| **Confiança / segurança** | verde profundo estável, neutros quentes, nada de saturação alta em áreas grandes | cabeçalho, barra de navegação, painéis de dados, autenticação |
| **Credibilidade institucional** | contraste alto, hierarquia clara, um só tom de marca repetido | títulos, tabelas, estados de conta e de pagamento |
| **Proximidade local** | dourado como acento quente, nunca como fundo dominante | destaques, selos, premium, promoções |
| **Ação** | um azul só para links e interação; verde para confirmar | botões secundários, links, likes, navegação |
| **Alerta** | âmbar para atenção, vermelho só para erro/destruição | validações, reembolsos, remoções |

Regra de ouro: **o verde carrega a marca, o dourado carrega o valor, os neutros
carregam o conteúdo**. Se um ecrã parecer "colorido demais", o problema é quase
sempre excesso de dourado ou de saturação, não falta de cor.

---

## 2. Paleta canónica

### Marca — verde
`--color-green-*` — de `#EEF7F4` (50) a `#071F1D` (950).

| Token | Hex | Uso |
| --- | --- | --- |
| `--color-green-900` | `#0B3B37` | cor institucional (é o `--ink`): títulos, barra, fundos escuros |
| `--color-green-800` | `#0F4A44` | superfície escura secundária |
| `--color-green-700` | `#176158` | hover de botões escuros, séries de gráfico |
| `--color-green-600` | `#2F9E68` | sucesso, valores positivos |
| `--color-green-500` | `#3FAE80` | realces, ícones de sucesso |
| `--color-green-300` | `#9BCDBB` | texto sobre fundo escuro (6,99:1) |
| `--color-green-100` | `#DCEAE6` | fundos de estado "ativo" |
| `--color-green-50` | `#EEF7F4` | fundo suave de sucesso |

### Valor — dourado
`--color-gold-*` — de `#FFF9ED` (50) a `#452A08` (950).
`--color-gold-500` (`#E8A23A`) é o acento de marca; `--color-gold-700` (`#A86516`)
é o mínimo para **texto** sobre fundo claro.

### Secundária quente — coral
`--color-coral-500` (`#EC6640`): promoções, séries de gráfico, realces pontuais.
Nunca em áreas grandes.

### Feedback
- Erro/destruição: `--color-red-600` (`#D92D20`).
- Atenção/pendente: `--color-yellow-500` (`#F59E0B`) em ícone/borda; para texto
  pequeno usar `--color-gold-700`.
- Informação/ligação: `--color-blue-600` (`#1570EF`).
- Sucesso: `--color-green-600` / `--color-green-700`.

### Neutros quentes
`--color-neutral-*`, de `#FFFFFF` a `#091B1E`, com `--color-neutral-50`
(`#F7F5F1`) como fundo de página. Os neutros são **quentes** de propósito: um
cinza azulado ao lado do verde faz o produto parecer frio e genérico.

---

## 3. Tokens semânticos (usar estes no código)

| Token | Valor | Onde |
| --- | --- | --- |
| `--ink` | `--color-green-900` | texto institucional e fundos escuros |
| `--ink-2` | `--color-green-800` | superfícies escuras |
| `--gold` | `--color-gold-500` | acento, selos, ícones |
| `--gold-2` | `--color-gold-600` | acento sobre claro |
| `--paper` | `--color-neutral-50` | fundo da página |
| `--paper-2` | `#FFFFFF` | cartões |
| `--text` | `--color-neutral-900` | texto normal |
| `--mute` | `--color-text-muted` | texto secundário |
| `--line` / `--line-2` | `neutral-200` / `neutral-300` | bordas |
| `--color-bg-surface` | `#FFFFFF` | cartões e painéis |
| `--color-bg-subtle` | `neutral-25` | fundos de secção |
| `--color-bg-dashboard-canvas` | `#F3EFE9` | fundo dos painéis de perfil |

Nas classes Tailwind já existe remapeamento: `emerald`/`teal`/`lime` → verde da
marca, `amber` → dourado, `orange`/`rose`/`pink`/`fuchsia` → coral,
`indigo`/`sky`/`cyan`/`purple`/`violet` → azul, `slate`/`gray`/`zinc`/`stone` →
neutro quente. Ou seja: classes do Tailwind são seguras, **hex arbitrário não é**.

---

## 4. Contraste verificado (WCAG 2.1)

Cálculo real sobre os pares usados no produto:

| Par | Rácio | Nível |
| --- | --- | --- |
| `#16221F` sobre `#F7F5F1` | 15,04:1 | AAA |
| `#16221F` sobre `#FFFFFF` | 16,37:1 | AAA |
| `#0B3B37` sobre `#F7F5F1` | 11,38:1 | AAA |
| `#FFFFFF` sobre `#0B3B37` | 12,39:1 | AAA |
| `#FFFFFF` sobre `#176158` | 7,27:1 | AAA |
| `#9BCDBB` sobre `#0B3B37` | 6,99:1 | AA |
| `#E8A23A` sobre `#0B3B37` | 5,70:1 | AA |
| `#5B6B67` sobre `#FFFFFF` | 5,61:1 | AA |
| `#5B6B67` sobre `#F7F5F1` | 5,15:1 | AA |
| `#D92D20` sobre `#FFFFFF` | 4,83:1 | AA |
| `#1570EF` sobre `#FFFFFF` | 4,57:1 | AA |
| `#A86516` sobre `#F7F5F1` | 4,25:1 | AA (texto grande) |
| `#2F9E68` sobre `#FFFFFF` | 3,38:1 | AA (só texto grande / ícone) |

Consequências práticas:

1. `--color-green-600` **não** serve para texto pequeno em branco — usar
   `--color-green-700` (`#176158`).
2. Dourado sobre fundo claro só a partir de `gold-700`; para ícone e selo,
   `gold-500` chega.
3. Texto mínimo 12 px; corpo 13–15 px (já definido em `--text-sm/md`).
4. Nunca usar cor como único sinal: erro leva ícone + texto, não só vermelho.

---

## 5. Regras de aplicação

1. **Zero hex em componentes.** `src/index.css` define; os componentes consomem
   `var(--token)` ou classes Tailwind remapeadas.
2. **Um acento por ecrã.** Dourado *ou* coral, não os dois em destaque.
3. **Fundos grandes são neutros ou verde escuro.** Dourado nunca preenche áreas
   maiores que um selo ou um botão.
4. **Gráficos** usam séries fixas: `#1570EF` (azul), `#2F9E68` (verde),
   `#C9852A` (dourado escuro), `#EC6640` (coral). Cores literais em bibliotecas
   de gráficos são exceção permitida, mas só com estes valores.
5. **Exportações** (PDF, XLSX, HTML) repetem a paleta: verde `#176158` para
   cabeçalhos, texto `#16221F`, secundário `#5B6B67`, linhas `#E4DFD4`.
6. **Tema escuro** escurece superfícies (`green-950`, `#0A1C18`, `#0D2924`) e
   clareia texto para `#EDF8F3`; nunca inverte a marca para dourado.

---

## 6. Como verificar

```bash
npm run audit:colors          # relatório de hex literais em componentes
npm run audit:colors -- --strict  # falha se existir algum
```

O verificador está em `scripts/audit-colors.mjs`. O objetivo é chegar a zero e
manter zero; o relatório lista ficheiro e linha para correção incremental.
