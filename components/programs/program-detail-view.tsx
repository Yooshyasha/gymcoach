'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronLeft, Download, Plus, Printer } from 'lucide-react';
import type { Exercise, Program, ProgramExercise, Workout } from '@/lib/prisma-client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgramEditDialog } from '@/components/programs/program-edit-dialog';
import { ProgramDeleteButton } from '@/components/programs/program-delete-button';
import { WorkoutCard } from '@/components/programs/workout-card';
import { WorkoutFormDialog } from '@/components/programs/workout-form-dialog';
import { useTrainingName } from '@/components/shared/use-training-name';

type ProgramExerciseWithExercise = ProgramExercise & { exercise: Exercise };
type WorkoutWithExercises = Workout & { exercises: ProgramExerciseWithExercise[] };
export type ProgramFull = Program & { workouts: WorkoutWithExercises[] };

interface Props {
  program: ProgramFull;
  catalog: Exercise[];
}

export function ProgramDetailView({ program, catalog }: Props) {
  const t = useTranslations('programs');
  const common = useTranslations('common');
  const trainingName = useTrainingName();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [addWorkoutOpen, setAddWorkoutOpen] = useState(false);
  const [activating, setActivating] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function toggleActive() {
    setActivating(true);
    try {
      const res = await fetch(`/api/programs/${program.id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !program.isActive }),
      });
      if (!res.ok) {
        toast.error(t('saveError'));
        return;
      }
      toast.success(program.isActive ? t('deactivated') : t('activated'));
      router.refresh();
    } finally {
      setActivating(false);
    }
  }

  // Downloads this one program (plus the exercises it references) as a
  // backup-shaped JSON file: importable as-is into an empty account via
  // Settings > Backup > Import, or merged by hand into an existing backup.
  async function exportProgram() {
    setExporting(true);
    try {
      const res = await fetch(`/api/programs/${program.id}/export`);
      if (!res.ok) {
        toast.error(t('exportError'));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const slug = program.name
        .toLocaleLowerCase('en-US')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
      a.download = `gymcoach-program-${slug || program.id}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('exportError'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link href="/programs">
          <ChevronLeft className="size-4" />
          <span className="ml-1">{common('actions.back')}</span>
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-xl">{trainingName(program.name)}</CardTitle>
              <CardDescription>{program.phase}</CardDescription>
            </div>
            {program.isActive && <Badge>{t('active')}</Badge>}
          </div>
        </CardHeader>
        {program.description && (
          <CardContent className="text-sm text-muted-foreground">{program.description}</CardContent>
        )}
        <CardContent className="flex flex-wrap gap-2 pt-0">
          <Button
            variant={program.isActive ? 'outline' : 'default'}
            size="sm"
            onClick={toggleActive}
            disabled={activating}
            className="min-h-tap"
          >
            {program.isActive ? t('deactivate') : t('activate')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="min-h-tap"
          >
            {common('actions.edit')}
          </Button>
          <Button asChild variant="outline" size="sm" className="min-h-tap">
            <Link href={`/programs/${program.id}/print`}>
              <Printer className="size-4" />
              <span className="ml-2">{t('print.action')}</span>
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportProgram}
            disabled={exporting}
            className="min-h-tap"
          >
            <Download className="size-4" />
            <span className="ml-2">{t('export')}</span>
          </Button>
          <ProgramDeleteButton programId={program.id} programName={trainingName(program.name)} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('sessions')}</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAddWorkoutOpen(true)}
          className="min-h-tap"
        >
          <Plus className="size-4" />
          <span className="ml-2">{t('addSession')}</span>
        </Button>
      </div>

      {program.workouts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('noSessions')}</CardTitle>
            <CardDescription>{t('noSessionsDescription')}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {program.workouts.map((w) => (
            <WorkoutCard key={w.id} workout={w} catalog={catalog} />
          ))}
        </div>
      )}

      <ProgramEditDialog open={editOpen} onOpenChange={setEditOpen} program={program} />
      <WorkoutFormDialog
        open={addWorkoutOpen}
        onOpenChange={setAddWorkoutOpen}
        mode="create"
        programId={program.id}
      />
    </div>
  );
}
