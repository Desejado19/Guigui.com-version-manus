// Pesquisa SQL tolerante a acentos sem depender da extensão `unaccent`.
//
// `translate(lower(coluna), <acentuadas>, <base>)` reduz o texto a letras base
// ("Administração" → "administracao"), pelo que a pesquisa escrita sem acentos
// encontra os registos acentuados. O parâmetro é reduzido da mesma forma em JS.
// Não altera dados nem índices existentes; a comparação continua a respeitar os
// filtros e permissões de cada consulta.

import { foldForSearch } from '../shared/textNormalization';

const ACCENTED = 'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ';
const BASE = 'aaaaaaeeeeiiiiooooouuuucnyy';

/** Expressão SQL que reduz a coluna a letras minúsculas sem acentos. */
export function foldedSql(column: string): string {
  return `translate(lower(${column}), '${ACCENTED}', '${BASE}')`;
}

/** Padrão LIKE (`%termo%`) reduzido da mesma forma que `foldedSql`. */
export function foldedLikePattern(term: string): string {
  return `%${foldForSearch(term)}%`;
}
