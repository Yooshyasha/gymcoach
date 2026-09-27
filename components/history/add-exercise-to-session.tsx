'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { WeightUnit } from '@/lib/prisma-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fromDisplayWeight } from '@/lib/units';
import { useExerciseName } from '@/components/shared/use-exercise-name';

export interface CatalogExercise {
  id: string;
  name: string;
}

interface Props {
  sessionId: string;
  // Strength exercises only (see the route file): cardio needs a different
  // set shape (duration/distance) that this quick-add form does not cover.
  catalog: CatalogExercise[];
  unit: WeightUnit;
}

// Logs a first set for an exercise that was not part of the session's plan
// - typically an exercise forgotten in the moment and added after the fact,
// via the same POST /api/sessions/[id]/sets the live session runner uses
// (it no longer gates on the session being finished).
export function AddExerciseToSession({ sessionId, catalog, unit }: Props) {
  const t = useTranslations('history.detail');
  const common = useTranslations('common');
  const exerciseName = useExerciseName();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [exerciseId, setExerciseId] = useState('');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [rir, setRir] = useState('');
  const [saving, setSaving] = useState(false);

  function reset() {
    setExerciseId('');
    setWeight('');
    setReps('');
    setRir('');
  }

  async function submit() {
    const weightDisplay = Number(weight);
    const repsValue = Number(reps);
    if (!exerciseId || !Number.isFinite(weightDisplay) || !Number.isFinite(repsValue)) {
      toast.error(t('addExerciseError'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/sets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseId,
          setNumber: 1,
          weight: fromDisplayWeight(weightDisplay, unit),
          reps: repsValue,
          rir: rir.trim() === '' ? null : Number(rir),
          isWarmup: false,
          isDropSet: false,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? t('addExerciseError'));
      }
      toast.success(t('addExerciseDone'));
      setOpen(false);
      reset();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('addExerciseError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-tap self-start"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
        <span className="ml-2">{t('addExercise')}</span>
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent>
          <DialogTitle>{t('addExercise')}</DialogTitle>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-exercise-select">{t('addExerciseChoose')}</Label>
              <Select value={exerciseId} onValueChange={setExerciseId}>
                <SelectTrigger id="add-exercise-select">
                  <SelectValue placeholder={t('addExerciseChoose')} />
                </SelectTrigger>
                <SelectContent>
                  {catalog.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {exerciseName(e.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="add-exercise-weight">{t('load')}</Label>
                <Input
                  id="add-exercise-weight"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="add-exercise-reps">{t('reps')}</Label>
                <Input
                  id="add-exercise-reps"
                  type="number"
                  inputMode="numeric"
                  step="1"
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="add-exercise-rir">RIR</Label>
                <Input
                  id="add-exercise-rir"
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min={0}
                  max={5}
                  value={rir}
                  onChange={(e) => setRir(e.target.value)}
                />
              </div>
            </div>
            <Button type="button" disabled={saving} onClick={submit} className="min-h-tap">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              <span className="ml-2">{common('actions.add')}</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
