const DATABASE_URL_PATTERN = /\bpostgres(?:ql)?:\/\/[^\s"'<>]+/gi;
const AUTHORIZATION_PATTERN =
  /(["']?\bauthorization\b["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|(?:(?:bearer|basic)\s+)?[^\s,;]+)/gi;
const SENSITIVE_VALUE_PATTERN =
  /(["']?\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|passwd|credential|client[_-]?secret)\b["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi;

function diagnosticText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}

export function sanitizeDiagnostic(error: unknown, maxLength = 500): string {
  if (!Number.isSafeInteger(maxLength) || maxLength < 0) {
    throw new RangeError('maxLength must be a non-negative integer.');
  }

  return diagnosticText(error)
    .replace(DATABASE_URL_PATTERN, '[REDACTED_DATABASE_URL]')
    .replace(AUTHORIZATION_PATTERN, '$1[REDACTED]')
    .replace(SENSITIVE_VALUE_PATTERN, '$1[REDACTED]')
    .slice(0, maxLength);
}
