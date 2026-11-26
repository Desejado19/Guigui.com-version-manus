import { describe, expect, it } from 'vitest';
import {
  foldForSearch,
  matchesSearch,
  normalizeDeep,
  normalizeUserText,
} from '../../shared/textNormalization';
import { validateUserIdentity } from '../../server/validationService';
import { foldedLikePattern, foldedSql } from '../../server/sqlSearch';

const WORDS = [
  'Administração',
  'Configurações',
  'Cidadão',
  'Informação',
  'Notificações',
  'Organização',
  'Promoção',
  'Publicação',
  'Segurança',
  'Transações',
  'Acessibilidade',
  'Autenticação',
  'Comércio',
  'Gestão',
  'Preço',
  'Descrição',
  'Guiné-Bissau',
];

describe('normalização de texto português', () => {
  it('preserva todos os caracteres portugueses intactos (NFC)', () => {
    for (const word of WORDS) {
      expect(normalizeUserText(word)).toBe(word);
      expect(normalizeUserText(word).normalize('NFC')).toBe(normalizeUserText(word));
    }
  });

  it('converte texto decomposto (NFD) para a forma composta (NFC)', () => {
    const decomposed = 'Administrac\u0327a\u0303o'; // ç e ã decompostos
    const normalized = normalizeUserText(decomposed);
    expect(normalized).toBe('Administração');
    expect(normalized.length).toBe('Administração'.length);
    expect(normalizeUserText('A\u0301lvaro')).toBe('Álvaro');
    expect(normalizeUserText('Guine\u0301-Bissau')).toBe('Guiné-Bissau');
  });

  it('não confunde NFC com NFD em comparações diretas', () => {
    const nfc = 'Cidadão';
    const nfd = 'Cidada\u0303o';
    expect(nfc).not.toBe(nfd);
    expect(normalizeUserText(nfd)).toBe(nfc);
  });

  it('remove caracteres de controlo e espaços nas extremidades sem tocar em acentos', () => {
    expect(normalizeUserText('  Promoção\u0000  ')).toBe('Promoção');
    expect(normalizeUserText('Descrição\t')).toBe('Descrição');
  });

  it('normaliza recursivamente objetos e arrays (payloads JSON)', () => {
    const payload = {
      title: 'Publicac\u0327a\u0303o',
      tags: ['Seguranc\u0327a', 'Prec\u0327o'],
      meta: { description: '  Com\u00e9rcio  ' },
      count: 3,
      active: true,
    };
    expect(normalizeDeep(payload)).toEqual({
      title: 'Publicação',
      tags: ['Segurança', 'Preço'],
      meta: { description: 'Comércio' },
      count: 3,
      active: true,
    });
  });

  it('preserva as chaves do payload intactas', () => {
    expect(normalizeDeep({ ' nome ': '  João  ', nested: { 'a b': ' X ' } })).toEqual({
      ' nome ': 'João',
      nested: { 'a b': 'X' },
    });
  });

  it('não deixa uma chave __proto__ alterar o protótipo', () => {
    const payload = JSON.parse('{"__proto__":{"polluted":true},"name":"  João  "}');
    const result = normalizeDeep(payload);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
    expect(JSON.parse(JSON.stringify(result))).toEqual(JSON.parse('{"__proto__":{"polluted":true},"name":"João"}'));
  });
});

describe('pesquisa tolerante a acentos', () => {
  it('encontra palavras acentuadas escritas sem acentos', () => {
    expect(foldForSearch('Administração')).toBe('administracao');
    expect(matchesSearch('Administração', foldForSearch('Administracao'))).toBe(true);
    expect(matchesSearch('Configurações', foldForSearch('configuracoes'))).toBe(true);
    expect(matchesSearch('Guiné-Bissau', foldForSearch('guine-bissau'))).toBe(true);
    expect(matchesSearch('Notificações', foldForSearch('NOTIFICACOES'))).toBe(true);
  });

  it('encontra palavras sem acentos escritas com acentos', () => {
    expect(matchesSearch('Administracao', foldForSearch('Administração'))).toBe(true);
    expect(matchesSearch('Seguranca', foldForSearch('Segurança'))).toBe(true);
  });

  it('continua a distinguir textos diferentes', () => {
    expect(matchesSearch('Organização', foldForSearch('promocao'))).toBe(false);
    expect(matchesSearch('', foldForSearch('administracao'))).toBe(false);
    expect(matchesSearch(null, foldForSearch('administracao'))).toBe(false);
  });

  it('reduz o mesmo termo no SQL (padrão LIKE e expressão da coluna)', () => {
    expect(foldedLikePattern('Administração')).toBe('%administracao%');
    expect(foldedLikePattern('Guiné-Bissau')).toBe('%guine-bissau%');
    expect(foldedLikePattern('NOTIFICAÇÕES')).toBe('%notificacoes%');
    expect(foldedSql('c.name')).toContain('translate(lower(c.name)');
    expect(foldedSql('s.caption')).toContain("'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ'");
  });
});

describe('validação aceita caracteres portugueses', () => {
  it('aceita nomes com acentos, cedilha e hífen (Guiné-Bissau)', () => {
    for (const name of WORDS) {
      const result = validateUserIdentity({ name, phone: '+245 955 123 456', role: 'citizen' });
      expect(result.ok, `rejeitou "${name}"`).toBe(true);
      expect(result.value?.name).toBe(name);
    }
  });

  it('guarda o nome em NFC, mesmo quando o cliente envia NFD', () => {
    const result = validateUserIdentity({
      name: 'Cidada\u0303o João da Conceic\u0327a\u0303o',
      phone: '+245 955 123 456',
      role: 'citizen',
    });
    expect(result.ok).toBe(true);
    expect(result.value?.name).toBe('Cidadão João da Conceição');
  });

  it('continua a rejeitar texto vazio e limites excedidos', () => {
    expect(validateUserIdentity({ name: '   ', phone: '+245 955 123 456', role: 'citizen' }).ok).toBe(false);
    expect(validateUserIdentity({ name: 'Ação'.repeat(60), phone: '+245 955 123 456', role: 'citizen' }).ok).toBe(false);
  });

  it('conta caracteres acentuados como um só (limite por caracteres, não por bytes)', () => {
    const name = 'Ação'.repeat(30); // 30 caracteres acentuados × 4 = 120
    const result = validateUserIdentity({ name, phone: '+245 955 123 456', role: 'citizen' });
    expect(name.length).toBe(120);
    expect(result.ok).toBe(true);
    expect(result.value?.name).toBe(name);
  });
});
