// Heavy libraries (xlsx, jspdf) are imported dynamically so they are code-split
// out of the main bundle and only fetched when the user actually exports.

export interface ExportColumn {
  key: string;
  label: string;
  type?: 'currency' | 'number' | 'date' | 'text';
}

export interface ExportData {
  title: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
}

function cell(value: unknown, type?: ExportColumn['type']): string {
  if (value === null || value === undefined) return '';
  if (type === 'currency') return '₹' + Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  if (type === 'date') return new Date(String(value)).toLocaleDateString('en-IN');
  return String(value);
}

const fileBase = (title: string) =>
  `${title.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}`;

export function exportCsv(data: ExportData) {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const header = data.columns.map((c) => esc(c.label)).join(',');
  const body = data.rows.map((r) => data.columns.map((c) => esc(cell(r[c.key], c.type))).join(',')).join('\n');
  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${fileBase(data.title)}.csv`);
}

export async function exportExcel(data: ExportData) {
  const XLSX = await import('xlsx');
  const aoa = [
    data.columns.map((c) => c.label),
    ...data.rows.map((r) => data.columns.map((c) => (c.type === 'currency' || c.type === 'number' ? Number(r[c.key] ?? 0) : cell(r[c.key], c.type)))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = data.columns.map((c) => ({ wch: Math.max(c.label.length + 2, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, data.title.slice(0, 31));
  XLSX.writeFile(wb, `${fileBase(data.title)}.xlsx`);
}

export async function exportPdf(data: ExportData) {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = autoTableMod.default;
  const doc = new jsPDF({ orientation: data.columns.length > 5 ? 'landscape' : 'portrait' });
  doc.setFontSize(14);
  doc.text(data.title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString('en-IN')} · Antariksha Trek Operations`, 14, 22);
  autoTable(doc, {
    startY: 28,
    head: [data.columns.map((c) => c.label)],
    body: data.rows.map((r) => data.columns.map((c) => cell(r[c.key], c.type))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 90, 245] },
    alternateRowStyles: { fillColor: [243, 246, 252] },
  });
  doc.save(`${fileBase(data.title)}.pdf`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
