'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check, Loader2, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import type { WeightUnit } from '@/lib/prisma-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatWeight, fromDisplayWeight, roundWeight, toDisplayWeight } from '@/lib/units';

export interface HistorySet {
  id: string;
  setNumber: number;
  weight: number;
  reps: number;
  rir: number | null;
  isWarmup: boolean;
  isDropSet: boolean;
  notes: string | null;
}

interface Props {
  sets: HistorySet[];
  usesBodyweight: boolean;
  bodyweight: number | null;
  unit: WeightUnit;
  locale: string;
}

interface Draft {
  weight: string;
  reps: string;
  rir: string;
}

// A finished session's strength sets stay correctable (PATCH /api/sets/[id]
// no longer gates on the session being finished). Read-only rows swap to
// inline inputs one at a time; a save re-fetches the whole page's server
// data (router.refresh) so totals - volume, est. 1RM - stay in sync.
export function EditableStrengthTable({ sets, usesBodyweight, bodyweight, unit, locale }: Props) {
  const t = useTranslations('history.detail');
  const common = useTranslations('common');
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ weight: '', reps: '', rir: '' });
  const [saving, setSaving] = useState(false);

  function startEdit(s: HistorySet) {
    setEditingId(s.id);
    setDraft({
      weight: String(roundWeight(toDisplayWeight(s.weight, unit), 2)),
      reps: String(s.reps),
      rir: s.rir == null ? '' : String(s.rir),
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(setId: string) {
    const weightDisplay = Number(draft.weight);
    const reps = Number(draft.reps);
    const rir = draft.rir.trim() === '' ? null : Number(draft.rir);
    if (!Number.isFinite(weightDisplay) || !Number.isFinite(reps)) {
      toast.error(t('updateError'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/sets/${setId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weight: fromDisplayWeight(weightDisplay, unit),
          reps,
          rir,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? t('updateError'));
      }
      setEditingId(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('updateError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
          <th className="py-1.5 font-medium">#</th>
          <th className="py-1.5 font-medium">{t('load')}</th>
          <th className="py-1.5 font-medium">{t('reps')}</th>
          <th className="py-1.5 font-medium">RIR</th>
          <th className="py-1.5 font-medium">{t('type')}</th>
          <th className="py-1.5 font-medium text-right">{common('actions.edit')}</th>
        </tr>
      </thead>
      <tbody>
        {sets.map((s) => {
          const isEditing = editingId === s.id;
          const isBw = usesBodyweight && !!bodyweight;
          const effective = isBw ? (bodyweight as number) + s.weight : s.weight;

          if (isEditing) {
            return (
              <tr key={s.id} className="border-b border-border/40">
                <td className="py-1.5">{s.setNumber}</td>
                <td className="py-1.5">
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={draft.weight}
                    onChange={(e) => setDraft((d) => ({ ...d, weight: e.target.value }))}
                    className="h-8 w-20"
                  />
                </td>
                <td className="py-1.5">
                  <Input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    value={draft.reps}
                    onChange={(e) => setDraft((d) => ({ ...d, reps: e.target.value }))}
                    className="h-8 w-16"
                  />
                </td>
                <td className="py-1.5">
                  <Input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min={0}
                    max={5}
                    value={draft.rir}
                    onChange={(e) => setDraft((d) => ({ ...d, rir: e.target.value }))}
                    className="h-8 w-14"
                  />
                </td>
                <td className="py-1.5 text-xs">
                  {s.isWarmup ? t('warmup') : s.isDropSet ? t('dropSet') : t('working')}
                </td>
                <td className="py-1.5">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      disabled={saving}
                      onClick={() => saveEdit(s.id)}
                    >
                      {saving ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Check className="size-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      disabled={saving}
                      onClick={cancelEdit}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          }

          return (
            <tr
              key={s.id}
              className={s.isWarmup ? 'text-muted-foreground' : 'border-b border-border/40'}
            >
              <td className="py-1.5">{s.setNumber}</td>
              <td className="py-1.5">
                {isBw ? (
                  <span>
                    {formatWeight(effective, unit, { decimals: 2, group: false, locale })}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({s.weight >= 0 ? '+' : ''}
                      {formatWeight(s.weight, unit, {
                        decimals: 2,
                        withUnit: false,
                        group: false,
                        locale,
                      })}{' '}
                      {t('external')})
                    </span>
                  </span>
                ) : effective === 0 ? (
                  t('bodyweight')
                ) : (
                  formatWeight(effective, unit, { decimals: 2, group: false, locale })
                )}
              </td>
              <td className="py-1.5">{s.reps}</td>
              <td className="py-1.5">{s.rir ?? '-'}</td>
              <td className="py-1.5 text-xs">
                {s.isWarmup ? t('warmup') : s.isDropSet ? t('dropSet') : t('working')}
              </td>
              <td className="py-1.5 text-right">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => startEdit(s)}
                >
                  <Pencil className="size-3.5" />
                </Button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
