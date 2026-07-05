import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, FileSpreadsheet, FileDown, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Card, CardTitle, EmptyState, Input, Label, Select, Skeleton } from '@/components/ui';
import { exportCsv, exportExcel, exportPdf, type ExportColumn } from '@/lib/export';
import { formatDate, inr } from '@/lib/utils';

interface Report {
  type: string;
  title: string;
  generatedAt: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
  summary: Record<string, number>;
}

const REPORTS = [
  { v: 'daily', l: 'Daily Report' },
  { v: 'weekly', l: 'Weekly Report' },
  { v: 'monthly', l: 'Monthly Report' },
  { v: 'yearly', l: 'Yearly Report' },
  { v: 'member', l: 'Member Report' },
  { v: 'trek', l: 'Trek Report' },
  { v: 'refund', l: 'Refund Report' },
  { v: 'payment', l: 'Payment Report' },
  { v: 'commission', l: 'Commission Report' },
];

const usesDateRange = (t: string) => ['daily', 'weekly', 'monthly', 'yearly', 'trek', 'payment'].includes(t);

function renderCell(value: unknown, type?: ExportColumn['type']) {
  if (value === null || value === undefined || value === '') return '—';
  if (type === 'currency') return inr(Number(value));
  if (type === 'date') return formatDate(String(value));
  return String(value);
}

export default function ReportsPage() {
  const [type, setType] = useState('monthly');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, isFetching } = useQuery({
    queryKey: ['report', type, from, to],
    queryFn: async () =>
      (await api.get('/reports', { params: { type, from: from || undefined, to: to || undefined } })).data.data as Report,
  });

  const exportData = data ? { title: data.title, columns: data.columns, rows: data.rows } : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FileText className="text-brand-500" />
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-slate-500">Generate and export operational reports.</p>
        </div>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px]">
            <Label>Report type</Label>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {REPORTS.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
            </Select>
          </div>
          {usesDateRange(type) && (
            <>
              <div>
                <Label>From (trek date)</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <Label>To (trek date)</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" disabled={!exportData?.rows.length} onClick={() => exportData && exportCsv(exportData)}>
              <FileDown size={15} /> CSV
            </Button>
            <Button variant="outline" size="sm" disabled={!exportData?.rows.length} onClick={() => exportData && exportExcel(exportData)}>
              <FileSpreadsheet size={15} /> Excel
            </Button>
            <Button variant="outline" size="sm" disabled={!exportData?.rows.length} onClick={() => exportData && exportPdf(exportData)}>
              <FileText size={15} /> PDF
            </Button>
          </div>
        </div>
      </Card>

      <Card className="space-y-3">
        <CardTitle className="flex items-center gap-2">
          {isFetching && <Loader2 className="animate-spin" size={14} />} {data?.title ?? 'Report'}
        </CardTitle>
        {isFetching && !data ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (data?.rows.length ?? 0) === 0 ? (
          <EmptyState title="No data for this report" hint="Try a different type or widen the date range." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  {data?.columns.map((c) => (
                    <th key={c.key} className={`px-3 py-2 ${c.type === 'currency' || c.type === 'number' ? 'text-right' : ''}`}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data?.rows.map((row, i) => (
                  <tr key={i} className="hover:bg-white/5">
                    {data.columns.map((c) => (
                      <td key={c.key} className={`px-3 py-2.5 ${c.type === 'currency' || c.type === 'number' ? 'text-right tabular-nums' : ''}`}>
                        {renderCell(row[c.key], c.type)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {data && Object.keys(data.summary).length > 0 && (
                <tfoot>
                  <tr className="border-t border-white/10 font-semibold">
                    {data.columns.map((c, idx) => (
                      <td key={c.key} className={`px-3 py-2.5 ${c.type === 'currency' || c.type === 'number' ? 'text-right tabular-nums' : ''}`}>
                        {idx === 0 ? 'Total' : c.key in data.summary ? renderCell(data.summary[c.key], c.type) : ''}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
