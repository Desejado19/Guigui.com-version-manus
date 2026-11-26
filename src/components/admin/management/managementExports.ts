import { downloadCSV, downloadExcel, downloadPDFReport } from '../../../utils/exportHelpers';

export type ManagementExportCell = string | number | null | undefined;

export function exportManagementCsv(
  filename: string,
  headers: string[],
  rows: ManagementExportCell[][],
) {
  downloadCSV(filename, headers, rows.map((row) => row.map((cell) => cell ?? '')));
}

export function exportManagementExcel(
  filename: string,
  sheetTitle: string,
  headers: string[],
  rows: ManagementExportCell[][],
) {
  downloadExcel(filename, sheetTitle, headers, rows.map((row) => row.map((cell) => cell ?? '')));
}

export function exportManagementPdf(options: {
  title: string;
  description: string;
  kpis: Array<{ label: string; value: string }>;
  headers: string[];
  rows: ManagementExportCell[][];
}) {
  downloadPDFReport(
    options.title,
    options.description,
    options.kpis,
    options.headers,
    options.rows.map((row) => row.map((cell) => cell ?? '')),
  );
}

export function slugifyFilename(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
