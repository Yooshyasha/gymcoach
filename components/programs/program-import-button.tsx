'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface ImportResult {
  createdPrograms: { id: string; name: string }[];
  createdExerciseCount: number;
  skipped: { programName: string; workoutName: string; exerciseName: string }[];
}

// Uploads a program export (GET /api/programs/[id]/export, or a hand-merged
// backup-shaped file) via POST /api/programs/import. Purely additive - unlike
// Settings > Backup > Import, nothing existing is ever replaced or deleted,
// so this needs no destructive-action confirmation step.
export function ProgramImportButton() {
  const t = useTranslations('programs');
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        toast.error(t('import.invalidJson'));
        return;
      }
      const res = await fetch('/api/programs/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? t('import.error'));
      }
      const result = (await res.json()) as ImportResult;
      const names = result.createdPrograms.map((p) => p.name).join(', ');
      toast.success(t('import.done', { count: result.createdPrograms.length, name: names }));
      if (result.skipped.length > 0) {
        toast.warning(t('import.skipped', { count: result.skipped.length }));
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('import.error'));
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={onFilePicked}
      />
      <Button
        type="button"
        variant="outline"
        className="min-h-tap"
        disabled={importing}
        onClick={() => fileRef.current?.click()}
      >
        {importing ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        <span className="ml-2">{t('import.action')}</span>
      </Button>
    </>
  );
}
