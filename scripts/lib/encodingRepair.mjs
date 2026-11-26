// Resolução de texto corrompido por perda de bytes (U+FFFD, "�").
//
// O carácter original desapareceu (bytes UTF-8 interpretados como Latin-1 e
// regravados em UTF-8), pelo que não existe forma de o recuperar por descodificação.
// A reconstrução usa o vocabulário já correto do repositório: para cada palavra
// corrompida procura-se a palavra limpa com o mesmo comprimento e o mesmo padrão
// de letras, escolhendo a mais frequente. As palavras raras ficam num mapa manual.
import fs from 'node:fs';
import path from 'node:path';

export const REPLACEMENT = '\uFFFD';
const TOKEN = /[\p{L}\uFFFD][\p{L}\uFFFD'’-]*/gu;

// Ficheiros/árvores que não fazem parte do produto ou que não devem ser reescritos.
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'dist-ssr', '.git', 'backups', 'coverage',
  'playwright-report', '.superpowers', 'docs', '.tmp-data-backup',
]);
const EXTS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.css', '.html', '.md']);
const SKIP_FILE = /^(\.tmp|pw-|playwright-report|diag-out)/;
const SKIP_PATH = [/scripts[\\/]fix-encoding\.mjs$/, /scripts[\\/]lib[\\/]/, /tests[\\/]fixtures[\\/]/];

export const MANUAL = {
  'nPer�odo': 'nPeríodo',
  'nPer�odo\'': 'nPeríodo\'',
  'Sess�o': 'Sessão',
  'necess�ria': 'necessária',
  'permiss�o': 'permissão',
  'opera��o': 'operação',
  'valida��o': 'validação',
  'Renova��o': 'Renovação',
  'Activa��o': 'Activação',
  'Activa��o\'': 'Activação\'',
  'Pr�xima': 'Próxima',
  'renova��o': 'renovação',
  'promo��es': 'promoções',
  'Restaura��o': 'Restauração',
  'Caf�s': 'Cafés',
  'Com�rcio': 'Comércio',
  'Cl�nicas': 'Clínicas',
  'M�dio': 'Médio',
  'Hot�is': 'Hotéis',
  'cl�nicas': 'clínicas',
  'm�dicas': 'médicas',
  'Constru��o': 'Construção',
  'Institui��es': 'Instituições',
  'concession�rias': 'concessionárias',
  'duplica��o': 'duplicação',
  'notifica��o': 'notificação',
  'Telem�vel': 'Telemóvel',
  'telem�vel': 'telemóvel',
  'v�deo': 'vídeo',
  'vers�o': 'versão',
  'demonstra��o': 'demonstração',
  'c�digo': 'código',
  'promo��o': 'promoção',
  'servi�o': 'serviço',
  'n�mero': 'número',
  'm�s': 'mês',
  'h�': 'há',
  'N�o': 'Não',
  'n�o': 'não',
  'poss�vel': 'possível',
  'est�': 'está',
  'cont�m': 'contém',
  'v�lidos': 'válidos',
  'sess�o': 'sessão',
  'tarif�rio': 'tarifário',
  'entrar�': 'entrará',
  'difama��o': 'difamação',
  'n�o-cliente': 'não-cliente',
  'Aprecia��o': 'Apreciação',
  'Ter�a\'': 'Terça\'',
  'Rom�ntico': 'Romântico',
  'Refei��es\'': 'Refeições\'',
  'GR�FICO': 'GRÁFICO',
  'VISUALIZA�ÕES': 'VISUALIZAÇÕES',
  'PROMO�ÕES': 'PROMOÇÕES',
  'suspens�o': 'suspensão',
  'Cidad�o': 'Cidadão',
  'Padr�o': 'Padrão',
  'Reativa��o': 'Reativação',
  'ap�s': 'após',
  'modera��o': 'moderação',
  'conclu�do': 'concluído',
  'navega��o': 'navegação',
  'notifica��es': 'notificações',
};

export function listProjectFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!EXTS.has(path.extname(entry.name).toLowerCase())) continue;
      if (SKIP_FILE.test(entry.name)) continue;
      if (SKIP_PATH.some((pattern) => pattern.test(full))) continue;
      out.push(full);
    }
  };
  walk(root);
  return out;
}

export function tokensOf(text) {
  return (text.match(TOKEN) || []).filter((token) => token.includes(REPLACEMENT));
}

export function buildVocabulary(texts) {
  const vocab = new Map();
  for (const text of texts) {
    for (const token of text.match(TOKEN) || []) {
      if (token.includes(REPLACEMENT) || token.length < 2) continue;
      const key = token.normalize('NFC');
      vocab.set(key, (vocab.get(key) || 0) + 1);
    }
  }
  return vocab;
}

function patternFor(token) {
  const escaped = token
    .replace(/\uFFFD/g, '\u0000')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\u0000/g, '.');
  return new RegExp(`^${escaped}$`, 'u');
}

/** Constrói o mapa palavra corrompida → palavra correta. */
export function buildMapping(corruptedTokens, vocab) {
  const mapping = new Map();
  const unresolved = [];
  for (const token of corruptedTokens) {
    if (MANUAL[token]) { mapping.set(token, MANUAL[token]); continue; }
    const pattern = patternFor(token);
    let best = null;
    let bestScore = -1;
    for (const [word, count] of vocab) {
      if (word.length !== token.length) continue;
      if (!pattern.test(word)) continue;
      if (count > bestScore) { best = word; bestScore = count; }
    }
    if (best) mapping.set(token, best);
    else unresolved.push(token);
  }
  return { mapping, unresolved };
}

/** Substituições mais longas primeiro (o token "�" isolado não pode vir antes). */
export function applyMapping(text, mapping) {
  let result = text;
  let changes = 0;
  for (const [from, to] of [...mapping].sort((a, b) => b[0].length - a[0].length)) {
    if (!result.includes(from)) continue;
    // Limites de palavra: "sess�o" não pode reparar "assess�o" pela metade.
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?<![\\p{L}\\uFFFD])${escaped}(?![\\p{L}\\uFFFD])`, 'gu');
    result = result.replace(pattern, () => {
      changes += 1;
      return to;
    });
  }
  return { text: result, changes };
}

let MANUAL_MAPPING = null;
/** Mapa fixo para valores de dados, sem depender do vocabulário do código. */
export function manualMapping() {
  if (!MANUAL_MAPPING) MANUAL_MAPPING = new Map(Object.entries(MANUAL));
  return MANUAL_MAPPING;
}

/** Repara uma string individual (valores da base de dados). */
export function repairString(value) {
  if (typeof value !== 'string' || !value.includes(REPLACEMENT)) return { value, changes: 0 };
  const result = applyMapping(value, manualMapping());
  return { value: result.text, changes: result.changes };
}
