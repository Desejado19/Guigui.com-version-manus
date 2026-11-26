// Normalização de texto para português (e restantes línguas com diacríticos).
//
// - `normalizeUserText` é aplicada na escrita: mantém o texto numa única forma
//   Unicode (NFC), que é a forma canónica preferida para armazenamento, e remove
//   caracteres de controlo que nunca pertencem a nomes, títulos ou descrições.
// - `foldForSearch` é usada apenas na pesquisa/comparação: remove os acentos
//   para que "Administracao" encontre "Administração". Nunca é gravada, para
//   não alterar a escrita dos utilizadores.

const COMBINING_MARKS = /[\u0300-\u036f]/g;
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Forma NFC, sem caracteres de controlo e sem espaços nas extremidades. */
export function normalizeUserText(value: string): string {
  return value.normalize('NFC').replace(CONTROL_CHARACTERS, '').trim();
}

/** Normaliza recursivamente strings de um valor JSON (nunca altera o tipo). */
export function normalizeDeep<T>(value: T): T {
  if (typeof value === 'string') return normalizeUserText(value) as unknown as T;
  if (Array.isArray(value)) return value.map((item) => normalizeDeep(item)) as unknown as T;
  if (value && typeof value === 'object') {
    // As chaves são estrutura do payload, não texto do utilizador: mudá-las
    // renomearia propriedades e podia fundir chaves distintas. `fromEntries`
    // cria propriedades próprias, pelo que uma chave `__proto__` não altera
    // o protótipo do objeto normalizado.
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalizeDeep(item)]),
    ) as T;
  }
  return value;
}

/** Texto comparável: sem acentos, minúsculas e sem espaços nas extremidades. */
export function foldForSearch(value: string): string {
  return value.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase().trim();
}

/** `haystack` contém `foldedNeedle` (já passado por `foldForSearch`)? */
export function matchesSearch(haystack: unknown, foldedNeedle: string): boolean {
  if (typeof haystack !== 'string' || !foldedNeedle) return false;
  return foldForSearch(haystack).includes(foldedNeedle);
}
