/**
 * Export Helpers for Guigui.com
 * Supports downloading CSV, native XLSX, formatted Print/PDF
 */

import writeXlsxFile, { type SheetData } from 'write-excel-file/browser';

export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent = [
    headers.join(';'),
    ...rows.map((row) =>
      row
        .map((cell) => {
          const str = String(cell ?? '').replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(';')
    ),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const EXCEL_HEADER_BACKGROUND = '#2F9E68';
const EXCEL_ZEBRA_BACKGROUND = '#F5FAF8';

/** O Excel limita o nome da folha a 31 caracteres e proíbe estes símbolos. */
function toSheetName(sheetTitle: string) {
  const cleaned = sheetTitle
    .replace(/[\\/?*[\]:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'Relatório').slice(0, 31);
}

function toXlsxFilename(filename: string) {
  return `${filename.replace(/\.xlsx?$/i, '')}.xlsx`;
}

/** Converte valores da tabela em células XLSX, preservando números como números. */
function toExcelCell(value: string | number | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { value, type: Number };
  }
  return { value: value == null ? '' : String(value), type: String };
}

function getColumnWidths(headers: string[], rows: (string | number)[][]) {
  return headers.map((header, index) => {
    const contentWidth = rows
      .slice(0, 100)
      .reduce((widest, row) => Math.max(widest, String(row[index] ?? '').length), 0);
    return { width: Math.min(40, Math.max(14, header.length + 4, contentWidth + 4)) };
  });
}

function buildSheetData(sheetTitle: string, headers: string[], rows: (string | number)[][]): SheetData {
  const columnCount = Math.max(1, headers.length);
  return [
    [{
      value: `Guigui.com - ${sheetTitle}`,
      type: String,
      fontWeight: 'bold',
      fontSize: 14,
      textColor: '#16221F',
      height: 24,
      columnSpan: columnCount,
    }],
    [{
      value: `Data de Emissão: ${new Date().toLocaleString('pt-PT')}`,
      type: String,
      textColor: '#5B6B67',
      columnSpan: columnCount,
    }],
    [],
    headers.map((header) => ({
      value: header,
      type: String,
      fontWeight: 'bold' as const,
      textColor: '#FFFFFF',
      backgroundColor: EXCEL_HEADER_BACKGROUND,
      align: 'center' as const,
      wrap: true,
      borderColor: EXCEL_HEADER_BACKGROUND,
      borderStyle: 'thin' as const,
    })),
    ...rows.map((row, rowIndex) => row.map((cell) => ({
      ...toExcelCell(cell),
      alignVertical: 'center' as const,
      backgroundColor: rowIndex % 2 === 1 ? EXCEL_ZEBRA_BACKGROUND : undefined,
      borderColor: '#E4DFD4',
      borderStyle: 'thin' as const,
    }))),
  ];
}

/**
 * Gera um ficheiro XLSX nativo (OOXML) no browser, com cabeçalho estilizado,
 * colunas dimensionadas e linhas de dados com tipos preservados.
 */
export function downloadExcel(filename: string, sheetTitle: string, headers: string[], rows: (string | number)[][]) {
  const sheetData = buildSheetData(sheetTitle, headers, rows);

  void writeXlsxFile(sheetData, {
    sheet: toSheetName(sheetTitle),
    columns: getColumnWidths(headers, rows),
    stickyRowsCount: 4,
  })
    .toFile(toXlsxFilename(filename))
    .catch((error: unknown) => {
      console.error('excel-export-failed', error);
    });
}

export interface ExcelWorkbookSheet {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

/** Livro Excel com uma folha por conjunto de dados da empresa. */
export function downloadExcelWorkbook(filename: string, sheets: ExcelWorkbookSheet[]) {
  if (sheets.length === 0) return;
  const workbook = sheets.map((sheet) => ({
    data: buildSheetData(sheet.title, sheet.headers, sheet.rows),
    sheet: toSheetName(sheet.title),
    columns: getColumnWidths(sheet.headers, sheet.rows),
    stickyRowsCount: 4,
  }));

  void writeXlsxFile(workbook)
    .toFile(toXlsxFilename(filename))
    .catch((error: unknown) => {
      console.error('excel-workbook-export-failed', error);
    });
}

export function triggerPrintReport(title: string, htmlContent: string) {
  try {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (printWindow && !printWindow.closed) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="pt">
          <head>
            <meta charset="utf-8" />
            <title>${title} - Guigui.com</title>
            <style>
              body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                color: #16221F;
                padding: 30px;
                background: #fff;
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 2px solid #176158;
                padding-bottom: 16px;
                margin-bottom: 24px;
              }
              .brand {
                font-size: 24px;
                font-weight: 700;
                color: #176158;
              }
              .brand span {
                color: #C9852A;
              }
              .meta {
                font-size: 12px;
                color: #5B6B67;
                text-align: right;
              }
              h1 {
                font-size: 20px;
                font-weight: 600;
                margin: 0 0 4px 0;
                color: #16221F;
              }
              .badge {
                display: inline-block;
                background: #EEF7F4;
                color: #0F4A44;
                font-size: 11px;
                font-weight: 700;
                padding: 4px 8px;
                border-radius: 6px;
                border: 1px solid #C2DFD4;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
                font-size: 12px;
              }
              th {
                background: #EEEAE2;
                color: #34423E;
                font-weight: 700;
                text-align: left;
                padding: 10px 12px;
                border-bottom: 2px solid #DCD6C8;
              }
              td {
                padding: 10px 12px;
                border-bottom: 1px solid #E4DFD4;
              }
              tr:nth-child(even) {
                background: #FCFBF8;
              }
              .kpi-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 12px;
                margin: 20px 0;
              }
              .kpi-card {
                background: #FCFBF8;
                border: 1px solid #E4DFD4;
                border-radius: 8px;
                padding: 12px;
              }
              .kpi-label {
                font-size: 10px;
                font-weight: 700;
                color: #5B6B67;
                text-transform: uppercase;
              }
              .kpi-val {
                font-size: 18px;
                font-weight: 600;
                color: #16221F;
                margin-top: 4px;
              }
              .footer {
                margin-top: 40px;
                border-top: 1px solid #E4DFD4;
                padding-top: 12px;
                font-size: 10px;
                color: #ABA79B;
                text-align: center;
              }
              @media print {
                body { padding: 0; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <div class="brand">Guigui<span>.com</span></div>
                <div style="font-size: 11px; color: #5B6B67; font-weight: 600;">Plataforma Comercial & Cultural de Bissau</div>
              </div>
              <div class="meta">
                <div>Documento Oficial de Relatório</div>
                <div>Emitido em: ${new Date().toLocaleString('pt-PT')}</div>
                <div class="badge">Autenticado pelo Sistema</div>
              </div>
            </div>

            ${htmlContent}

            <div class="footer">
              Guigui.com • Direitos Reservados © 2026 • República da Guiné-Bissau • Documento gerado eletronicamente.
            </div>

            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 300);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
      return;
    }
  } catch {
    // Popup might be blocked inside iframe
  }

  // Fallback: download as printable HTML report file
  const fullHtml = `<!DOCTYPE html>
<html lang="pt">
  <head>
    <meta charset="utf-8" />
    <title>${title} - Guigui.com</title>
    <style>
      body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 25px; color: #16221F; }
      table { width: 100%; border-collapse: collapse; margin: 20px 0; }
      th, td { padding: 8px 12px; border: 1px solid #E4DFD4; text-align: left; }
      th { background: #EEEAE2; }
      .header { border-bottom: 2px solid #176158; padding-bottom: 12px; margin-bottom: 20px; }
      .brand { font-size: 22px; font-weight: bold; color: #176158; }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="brand">Guigui.com</div>
      <div>Emitido em: ${new Date().toLocaleString('pt-PT')}</div>
    </div>
    ${htmlContent}
  </body>
</html>`;

  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${title.replace(/\s+/g, '_')}_Relatorio.html`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadPDFReport(title: string, summary: string, kpis: { label: string; value: string }[], headers: string[], rows: (string | number)[][]) {
  const kpisHtml = kpis.length > 0 ? `
    <div class="kpi-grid">
      ${kpis.map((k) => `
        <div class="kpi-card">
          <div class="kpi-label">${k.label}</div>
          <div class="kpi-val">${k.value}</div>
        </div>
      `).join('')}
    </div>
  ` : '';

  const tableHtml = `
    <table>
      <thead>
        <tr>
          ${headers.map((h) => `<th>${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            ${row.map((cell) => `<td>${cell}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  const fullContent = `
    <h1>${title}</h1>
    <p style="font-size: 13px; color: #52615C; line-height: 1.5;">${summary}</p>
    ${kpisHtml}
    ${tableHtml}
  `;

  triggerPrintReport(title, fullContent);
}
