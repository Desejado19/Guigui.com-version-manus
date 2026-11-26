// Política de palavras-passe partilhada pelo servidor e pela interface.
//
// O servidor é a autoridade: a interface usa as mesmas regras só para mostrar
// o que falta antes de submeter, nunca para decidir se a palavra-passe serve.

export interface PasswordPolicyInput {
  password: string;
  currentPassword?: string;
  email?: string;
  name?: string;
}

export interface PasswordPolicyResult {
  ok: boolean;
  issues: string[];
  /** 0 a 4 — usado pelo medidor de força da interface. */
  score: number;
  label: 'Muito fraca' | 'Fraca' | 'Razoável' | 'Forte' | 'Muito forte';
}

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', 'password', 'password1', 'password123',
  'qwerty123', 'qwertyui', 'iloveyou', 'admin123', 'administrador', 'guigui',
  'guigui123', 'guigui2024', 'guigui2025', 'guigui2026', 'bissau123', 'senha123',
  'abc12345', 'letmein1', 'welcome1', 'monkey123', 'dragon123',
]);

function classesUsed(password: string) {
  return {
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    digit: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
}

export function evaluatePassword(input: PasswordPolicyInput): PasswordPolicyResult {
  const password = input.password || '';
  const issues: string[] = [];
  const classes = classesUsed(password);
  const classCount = Number(classes.lower) + Number(classes.upper) + Number(classes.digit) + Number(classes.symbol);

  if (password.length < PASSWORD_MIN_LENGTH) {
    issues.push(`A palavra-passe deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    issues.push(`A palavra-passe não pode exceder ${PASSWORD_MAX_LENGTH} caracteres.`);
  }
  if (!classes.lower && !classes.upper) {
    issues.push('Inclua pelo menos uma letra.');
  }
  if (!classes.digit) {
    issues.push('Inclua pelo menos um número.');
  }
  if (classCount < 3) {
    issues.push('Combine pelo menos três tipos: minúsculas, maiúsculas, números e símbolos.');
  }
  if (input.currentPassword && password === input.currentPassword) {
    issues.push('A nova palavra-passe tem de ser diferente da atual.');
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase().replace(/\s+/g, ''))) {
    issues.push('Esta palavra-passe é demasiado comum. Escolha outra.');
  }
  const emailLocalPart = (input.email || '').split('@')[0]?.trim().toLowerCase();
  if (emailLocalPart && emailLocalPart.length >= 3 && password.toLowerCase().includes(emailLocalPart)) {
    issues.push('A palavra-passe não deve conter o nome da conta de e-mail.');
  }
  const nameParts = (input.name || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((part) => part.length >= 3);
  if (nameParts.length > 0 && password.toLowerCase().includes(nameParts[0])) {
    issues.push('A palavra-passe não deve conter o seu nome.');
  }
  const repeated = /^(.)\1{5,}$/.test(password);
  if (repeated) {
    issues.push('Evite repetir o mesmo caractere.');
  }

  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (password.length >= 12) score += 1;
  if (classCount >= 3) score += 1;
  if (classCount === 4 && password.length >= 14) score += 1;
  if (issues.length > 0) score = Math.min(score, 1);
  const labels: PasswordPolicyResult['label'][] = ['Muito fraca', 'Fraca', 'Razoável', 'Forte', 'Muito forte'];
  const cappedScore = Math.max(0, Math.min(4, issues.length > 0 ? Math.min(score, 1) : score));

  return {
    ok: issues.length === 0,
    issues,
    score: cappedScore,
    label: labels[cappedScore],
  };
}
