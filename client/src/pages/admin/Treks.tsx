import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mountain, Plus, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, apiError } from '@/lib/api';
import { Button, Card, Input, Label, Skeleton } from '@/components/ui';
import { inr } from '@/lib/utils';

interface Trek {
  id: string;
  name: string;
  permit_price: number;
  is_active: boolean;
}

export default function TreksPage() {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [newTrek, setNewTrek] = useState({ name: '', permitPrice: 500 });

  const { data: treks, isLoading } = useQuery({
    queryKey: ['treks'],
    queryFn: async () => (await api.get('/treks')).data.data as Trek[],
  });

  const update = useMutation({
    mutationFn: async (v: { id: string; permitPrice: number }) =>
      api.patch(`/treks/${v.id}`, { permitPrice: v.permitPrice }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['treks'] });
      toast.success('Price updated (existing tickets keep their original price)');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const create = useMutation({
    mutationFn: async () => api.post('/treks', newTrek),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['treks'] });
      setNewTrek({ name: '', permitPrice: 500 });
      toast.success('Trek added');
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Mountain className="text-brand-500" />
        <div>
          <h1 className="text-2xl font-bold">Trek Pricing</h1>
          <p className="text-sm text-slate-500">Editing a price never changes already-submitted tickets.</p>
        </div>
      </div>

      <Card>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="flex-1">
            <Label>New trek name</Label>
            <Input required value={newTrek.name} onChange={(e) => setNewTrek((t) => ({ ...t, name: e.target.value }))} placeholder="e.g. Ombattu Gudda" />
          </div>
          <div className="w-40">
            <Label>Permit price (₹)</Label>
            <Input
              type="number"
              min={0}
              value={newTrek.permitPrice}
              onChange={(e) => setNewTrek((t) => ({ ...t, permitPrice: Number(e.target.value) }))}
            />
          </div>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Add Trek
          </Button>
        </form>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32" />)
          : treks?.map((t) => {
              const value = edits[t.id] ?? Number(t.permit_price);
              const dirty = value !== Number(t.permit_price);
              return (
                <Card key={t.id} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{t.name}</h3>
                    {!t.is_active && <span className="text-xs text-rose-400">inactive</span>}
                  </div>
                  <div>
                    <Label>Permit price per person</Label>
                    <Input
                      type="number"
                      min={0}
                      value={value}
                      onChange={(e) => setEdits((m) => ({ ...m, [t.id]: Number(e.target.value) }))}
                    />
                    <p className="mt-1 text-xs text-slate-500">Current: {inr(t.permit_price)}</p>
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={!dirty || update.isPending}
                    onClick={() => update.mutate({ id: t.id, permitPrice: value })}
                  >
                    <Save size={14} /> Save
                  </Button>
                </Card>
              );
            })}
      </div>
    </div>
  );
}
