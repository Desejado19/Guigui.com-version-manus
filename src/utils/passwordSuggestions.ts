// Sugestões de palavras-passe geradas no browser.
//
// Nunca são enviadas para o servidor nem guardadas: servem só para o utilizador
// escolher uma palavra-passe mais forte. Combinam palavras comuns em português
// com um número e um símbolo, o que cumpre a política sem ser ilegível.

import { evaluatePassword } from '../../shared/passwordPolicy';

const WORDS = [
  'mandioca', 'caju', 'mangueira', 'calema', 'tabanka', 'gumbe', 'kizomba',
  'bijagó', 'bolama', 'cacheu', 'bissau', 'gabú', 'quinara', 'bafatá',
  'arroz', 'peixe', 'ostra', 'coco', 'manga', 'papagaio', 'pelicano',
  'casa', 'mercado', 'bandeira', 'estrela', 'lagoa', 'areia', 'ponte',
  'violão', 'tambor', 'coro', 'festa', 'viagem', 'jardim', 'fonte',
];

const SYMBOLS = ['!', '#', '%', '&', '*', '?', '@', '+', '='];

function randomInt(max: number): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function pick<T>(items: T[]): T {
  return items[randomInt(items.length)];
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Devolve sugestões prontas a usar. O padrão é "Palavra-Palavra12!" para ser
 * fácil de memorizar e difícil de adivinhar, com variações de símbolo/números.
 */
export function suggestPasswords(count = 3): string[] {
  const suggestions: string[] = [];
  let attempts = 0;
  while (suggestions.length < count && attempts < count * 12) {
    attempts += 1;
    const first = pick(WORDS);
    const second = pick(WORDS.filter((word) => word !== first));
    const number = 10 + randomInt(90);
    const symbol = pick(SYMBOLS);
    const candidate = `${capitalize(first)}-${capitalize(second)}${number}${symbol}`;
    if (suggestions.includes(candidate)) continue;
    if (!evaluatePassword({ password: candidate }).ok) continue;
    suggestions.push(candidate);
  }
  return suggestions;
}
