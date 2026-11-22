import { describe, expect, it } from 'vitest';
import {
  MANUAL,
  applyMapping,
  buildMapping,
  buildVocabulary,
  tokensOf,
} from '../../scripts/lib/encodingRepair.mjs';

const R = '\uFFFD';

describe('reparação de palavras com caracteres perdidos', () => {
  it('resolve pelo vocabulário uma palavra do mesmo comprimento', () => {
    const vocabulary = buildVocabulary(['Sessão e sessão.']);
    const { mapping, unresolved } = buildMapping([`Sess${R}o`], vocabulary);
    expect(unresolved).toEqual([]);
    expect(mapping.get(`Sess${R}o`)).toBe('Sessão');
  });

  it('não substitui um fragmento dentro de outra palavra', () => {
    const result = applyMapping(`assess${R}o e sess${R}o`, new Map([[`sess${R}o`, 'sessão']]));
    expect(result.text).toBe(`assess${R}o e sessão`);
    expect(result.changes).toBe(1);
  });

  it('aplica o mapa manual e conta cada substituição', () => {
    const result = applyMapping(`nPer${R}odo`, new Map(Object.entries(MANUAL)));
    expect(result.text).toBe('nPeríodo');
    expect(result.changes).toBe(1);
  });

  it('extrai apenas palavras danificadas', () => {
    expect(tokensOf(`texto saudável e Sess${R}o`)).toEqual([`Sess${R}o`]);
  });
});
