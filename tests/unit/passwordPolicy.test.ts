import { describe, expect, it } from 'vitest';
import { PASSWORD_MIN_LENGTH, evaluatePassword } from '../../shared/passwordPolicy';

describe('shared/passwordPolicy', () => {
  it('rejeita uma palavra-passe curta', () => {
    const result = evaluatePassword({ password: 'Ab3!' });

    expect(result.ok).toBe(false);
    expect(result.issues).toContain(`A palavra-passe deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('rejeita uma palavra-passe comum mesmo que pareça composta', () => {
    const result = evaluatePassword({ password: 'guigui2026' });

    expect(result.ok).toBe(false);
    expect(result.issues).toContain('Esta palavra-passe é demasiado comum. Escolha outra.');
  });

  it('rejeita uma palavra-passe baseada no nome da conta', () => {
    const result = evaluatePassword({ password: 'Malam-Bacar-92!', name: 'Malam Bacar' });

    expect(result.ok).toBe(false);
    expect(result.issues).toContain('A palavra-passe não deve conter o seu nome.');
  });

  it('rejeita uma palavra-passe baseada no e-mail da conta', () => {
    const result = evaluatePassword({ password: 'cidadao.teste-92!', email: 'cidadao.teste@guigui.com' });

    expect(result.ok).toBe(false);
    expect(result.issues).toContain('A palavra-passe não deve conter o nome da conta de e-mail.');
  });

  it('rejeita uma nova palavra-passe idêntica à atual', () => {
    const result = evaluatePassword({ password: 'Caju-Verde-2026#', currentPassword: 'Caju-Verde-2026#' });

    expect(result.ok).toBe(false);
    expect(result.issues).toContain('A nova palavra-passe tem de ser diferente da atual.');
  });

  it('aceita uma palavra-passe forte e devolve uma pontuação alta', () => {
    const result = evaluatePassword({ password: 'Caju-Verde-2026#', email: 'cidadao.teste@guigui.com', name: 'Malam Bacar' });

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.score).toBeGreaterThanOrEqual(3);
  });
});
