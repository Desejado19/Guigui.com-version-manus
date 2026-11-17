export type StorageIssueKind =
  | 'quota_exceeded'
  | 'indexeddb_unavailable'
  | 'read_failed'
  | 'write_failed'
  | 'cache_expired'
  | 'sync_failed';

export interface StorageIssue {
  kind: StorageIssueKind;
  key: string;
  message: string;
  at: string;
}

const MAX_ISSUES = 50;
const issues: StorageIssue[] = [];

/**
 * Registo estruturado em memória. Nunca inclui o valor guardado, por isso
 * passwords, tokens e dados pessoais não podem aparecer nos diagnósticos.
 */
export function reportStorageIssue(kind: StorageIssueKind, key: string, error: unknown): void {
  // Só o tipo do erro: a mensagem pode conter o valor serializado (dados
  // pessoais, tokens ou conteúdo privado) e nunca deve ir para diagnósticos.
  const message = error instanceof Error ? error.name : 'unknown_error';
  const issue: StorageIssue = {
    kind,
    key,
    message: message.slice(0, 80),
    at: new Date().toISOString(),
  };
  issues.push(issue);
  if (issues.length > MAX_ISSUES) issues.splice(0, issues.length - MAX_ISSUES);
  // Diagnóstico técnico sem conteúdo do registo.
  console.warn('[guigui-storage]', issue);
}

export function getStorageIssues(): StorageIssue[] {
  return [...issues];
}

export function clearStorageIssues(): void {
  issues.length = 0;
}
