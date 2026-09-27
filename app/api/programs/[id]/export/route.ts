import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { BACKUP_VERSION } from '@/lib/backup-version';
import { ApiError, handleApiError, requireApiUserId } from '@/lib/api';

interface Params {
  params: Promise<{ id: string }>;
}

// GET /api/programs/[id]/export: a single-program backup file, sharing the
// same field shapes and version as /api/backup so it can be dropped straight
// into Settings > Backup > Import (fresh account) or merged by hand into an
// existing full backup (jq) before importing. Only the program and the
// exercises it actually references are included - no sessions, no other
// programs, no gyms, no coach history.
export async function GET(_req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();

    const program = await db.program.findFirst({
      where: { id: params.id, userId },
      include: {
        workouts: {
          orderBy: { order: 'asc' },
          include: {
            exercises: {
              orderBy: { order: 'asc' },
              include: { exercise: true },
            },
          },
        },
      },
    });
    if (!program) throw new ApiError(404, 'Program not found.');

    // Referenced exercise names, deduped, preserving first-seen order.
    const exerciseNames: string[] = [];
    const seen = new Set<string>();
    for (const w of program.workouts) {
      for (const pe of w.exercises) {
        if (seen.has(pe.exercise.name)) continue;
        seen.add(pe.exercise.name);
        exerciseNames.push(pe.exercise.name);
      }
    }

    const exercises = await db.exercise.findMany({
      where: { userId, name: { in: exerciseNames } },
    });
    const exerciseByName = new Map(exercises.map((e) => [e.name, e]));

    return NextResponse.json({
      version: BACKUP_VERSION,
      exercises: exerciseNames.flatMap((name) => {
        const e = exerciseByName.get(name);
        if (!e) return [];
        return [
          {
            name: e.name,
            muscleGroup: e.muscleGroup,
            category: e.category,
            defaultRestSec: e.defaultRestSec,
            notes: e.notes,
            usesBodyweight: e.usesBodyweight,
            equipmentType: e.equipmentType,
          },
        ];
      }),
      // Exported as inactive: the recipient decides what to activate. The
      // importer treats this the same as any backup program.
      programs: [
        {
          name: program.name,
          description: program.description,
          phase: program.phase,
          isActive: false,
          startDate: program.startDate.toISOString(),
          endDate: program.endDate?.toISOString() ?? null,
          workouts: program.workouts.map((w) => ({
            name: w.name,
            dayOfWeek: w.dayOfWeek,
            order: w.order,
            exercises: w.exercises.map((pe) => ({
              exerciseName: pe.exercise.name,
              order: pe.order,
              targetSets: pe.targetSets,
              targetRepsMin: pe.targetRepsMin,
              targetRepsMax: pe.targetRepsMax,
              targetRIR: pe.targetRIR,
              restSec: pe.restSec,
              autoregulationMode: pe.autoregulationMode,
              fatigueRate: pe.fatigueRate,
              loadAdjustmentPct: pe.loadAdjustmentPct,
              tempo: pe.tempo,
              notes: pe.notes,
              supersetGroup: pe.supersetGroup,
            })),
          })),
        },
      ],
      // Required by the backup import schema; empty here (single-program
      // export carries no training history).
      sessions: [],
    });
  } catch (err) {
    return handleApiError(err);
  }
}
