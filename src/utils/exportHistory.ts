/**
 * Histórico local das exportações de cada empresa.
 *
 * O módulo de exportação gera os ficheiros no browser; este registo guarda o
 * rasto de cada operação (quem exportou, o quê, em que formato e quantos
 * registos) para a secção «Histórico de exportações». A chave é isolada por
 * empresa para que duas contas no mesmo dispositivo nunca vejam o histórico
 * uma da outra.
 */

export type ExportHistoryFormat = 'csv' | 'xlsx' | 'pdf';

export interface ExportHistoryEntry {
  id: string;
  businessId: string;
  fileName: string;
  category: string;
  format: ExportHistoryFormat;
  records: number;
  actor: string;
  createdAt: string;
  status: 'completed' | 'failed';
  detail?: string;
}

const MAX_ENTRIES = 60;

export function exportHistoryKey(businessId: string): string {
  return `guigui_export_history_${businessId}`;
}

export function readExportHistory(businessId: string): ExportHistoryEntry[] {
  if (typeof window === 'undefined' || !businessId) return [];
  try {
    const raw = window.localStorage.getItem(exportHistoryKey(businessId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is ExportHistoryEntry => (
      Boolean(entry)
      && typeof entry === 'object'
      && typeof (entry as ExportHistoryEntry).id === 'string'
      && typeof (entry as ExportHistoryEntry).fileName === 'string'
    ));
  } catch {
    return [];
  }
}

export function recordExportHistory(businessId: string, entry: Omit<ExportHistoryEntry, 'id' | 'businessId' | 'createdAt'>): ExportHistoryEntry | null {
  if (typeof window === 'undefined' || !businessId) return null;
  const record: ExportHistoryEntry = {
    ...entry,
    id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    businessId,
    createdAt: new Date().toISOString(),
  };
  try {
    const next = [record, ...readExportHistory(businessId)].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(exportHistoryKey(businessId), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('guigui:export-history', { detail: { businessId } }));
    return record;
  } catch {
    return record;
  }
}

export function clearExportHistory(businessId: string): void {
  if (typeof window === 'undefined' || !businessId) return;
  try {
    window.localStorage.removeItem(exportHistoryKey(businessId));
    window.dispatchEvent(new CustomEvent('guigui:export-history', { detail: { businessId } }));
  } catch {
    // Sem armazenamento disponível: o histórico fica vazio nesta sessão.
  }
}
