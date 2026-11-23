import { describe, expect, it } from 'vitest';
import { normaliseAndValidateEmail, normaliseEmailForAccount } from '../../shared/emailAddress';

describe('normaliseAndValidateEmail', () => {
  it.each([
    'cidadao@guigui.com',
    'empresa.contacto@empresa.gw',
    'admin+staff@guigui.com',
    'utilizador_1@sub.dominio.co.uk',
  ])('aceita %s', (email) => {
    expect(normaliseAndValidateEmail(email)).toEqual({ ok: true, email });
  });

  it('normaliza espaços e o domínio para minúsculas', () => {
    expect(normaliseAndValidateEmail('  Fatou@Guigui.COM  ')).toEqual({
      ok: true,
      email: 'Fatou@guigui.com',
    });
  });

  it('normaliza contas para minúsculas (comparação e unicidade)', () => {
    expect(normaliseEmailForAccount('  Fatou@Guigui.COM ')).toEqual({
      ok: true,
      email: 'fatou@guigui.com',
    });
  });

  it.each([
    ['vazio', ''],
    ['só espaços', '   '],
    ['sem @', 'cidadao.guigui.com'],
    ['sem domínio', 'cidadao@'],
    ['sem parte local', '@guigui.com'],
    ['sem TLD', 'cidadao@localhost'],
    ['com espaço', 'cidadao @guigui.com'],
    ['lista', 'a@guigui.com,b@guigui.com'],
    ['ponto inicial', '.cidadao@guigui.com'],
    ['ponto final', 'cidadao.@guigui.com'],
    ['pontos consecutivos', 'cidadao..teste@guigui.com'],
    ['TLD numérico', 'cidadao@guigui.123'],
    ['label com hífen nas pontas', 'cidadao@-guigui.com'],
    ['caracter de controlo', 'cidadao@guigui.com\nBcc: outro@exemplo.com'],
  ])('rejeita %s', (_label, email) => {
    const result = normaliseAndValidateEmail(email);
    expect(result.ok).toBe(false);
  });

  it('rejeita endereços acima de 254 caracteres', () => {
    const email = `${'a'.repeat(64)}@${'b'.repeat(190)}.com`;
    const result = normaliseAndValidateEmail(email);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('EMAIL_TOO_LONG');
  });

  it('rejeita valores que não são texto', () => {
    expect(normaliseAndValidateEmail(42).ok).toBe(false);
    expect(normaliseAndValidateEmail(null).ok).toBe(false);
    expect(normaliseAndValidateEmail(undefined).ok).toBe(false);
  });
});
