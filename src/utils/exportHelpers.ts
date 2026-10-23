/**
 * Export Helpers for Guigui.com
 * Supports downloading CSV, Excel-compatible CSV/XML, formatted Print/PDF
 */

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

export function downloadExcel(filename: string, sheetTitle: string, headers: string[], rows: (string | number)[][]) {
  // Generates an Excel-compatible XML Spreadsheet 2003 format
  const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#10B981" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:Bold="1" ss:Size="14" ss:Color="#0F172A"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${sheetTitle.replace(/[/\\?*[\]]/g, '')}">
  <Table>
   <Row><Cell ss:StyleID="Title"><Data ss:Type="String">Guigui.com - ${sheetTitle}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Data de Emissão: ${new Date().toLocaleString('pt-PT')}</Data></Cell></Row>
   <Row></Row>
   <Row>
    ${headers.map((h) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${h}</Data></Cell>`).join('\n    ')}
   </Row>
   ${rows
     .map(
       (r) =>
         `<Row>\n    ${r
           .map((c) => {
             const isNum = typeof c === 'number';
             return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${String(c ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Data></Cell>`;
           })
           .join('\n    ')}\n   </Row>`
     )
     .join('\n   ')}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xmlHeader], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.xls') ? filename : `${filename}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
                color: #0f172a;
                padding: 30px;
                background: #fff;
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 2px solid #059669;
                padding-bottom: 16px;
                margin-bottom: 24px;
              }
              .brand {
                font-size: 24px;
                font-weight: 700;
                color: #059669;
              }
              .brand span {
                color: #f59e0b;
              }
              .meta {
                font-size: 12px;
                color: #64748b;
                text-align: right;
              }
              h1 {
                font-size: 20px;
                font-weight: 600;
                margin: 0 0 4px 0;
                color: #0f172a;
              }
              .badge {
                display: inline-block;
                background: #ecfdf5;
                color: #065f46;
                font-size: 11px;
                font-weight: 700;
                padding: 4px 8px;
                border-radius: 6px;
                border: 1px solid #a7f3d0;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
                font-size: 12px;
              }
              th {
                background: #f1f5f9;
                color: #334155;
                font-weight: 700;
                text-align: left;
                padding: 10px 12px;
                border-bottom: 2px solid #cbd5e1;
              }
              td {
                padding: 10px 12px;
                border-bottom: 1px solid #e2e8f0;
              }
              tr:nth-child(even) {
                background: #f8fafc;
              }
              .kpi-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 12px;
                margin: 20px 0;
              }
              .kpi-card {
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 12px;
              }
              .kpi-label {
                font-size: 10px;
                font-weight: 700;
                color: #64748b;
                text-transform: uppercase;
              }
              .kpi-val {
                font-size: 18px;
                font-weight: 600;
                color: #0f172a;
                margin-top: 4px;
              }
              .footer {
                margin-top: 40px;
                border-top: 1px solid #e2e8f0;
                padding-top: 12px;
                font-size: 10px;
                color: #94a3b8;
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
                <div style="font-size: 11px; color: #64748b; font-weight: 600;">Plataforma Comercial & Cultural de Bissau</div>
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
      body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 25px; color: #0f172a; }
      table { width: 100%; border-collapse: collapse; margin: 20px 0; }
      th, td { padding: 8px 12px; border: 1px solid #e2e8f0; text-align: left; }
      th { background: #f1f5f9; }
      .header { border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 20px; }
      .brand { font-size: 22px; font-weight: bold; color: #059669; }
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
    <p style="font-size: 13px; color: #475569; line-height: 1.5;">${summary}</p>
    ${kpisHtml}
    ${tableHtml}
  `;

  triggerPrintReport(title, fullContent);
}
