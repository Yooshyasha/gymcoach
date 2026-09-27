import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { programImportSchema } from '@/lib/schemas/program-import';
import { handleApiError, parseJsonBody, requireApiUserId } from '@/lib/api';

// POST /api/programs/import: the counterpart to GET /api/programs/[id]/export.
// Unlike /api/backup's POST (a full-account REPLACE that wipes everything
// first), this is purely ADDITIVE: it never deletes or modifies anything the
// account already has. Exercises are matched to the existing catalog by exact
// name and reused; anything not found is created. Every imported program
// lands inactive regardless of the file's `isActive` value, so importing
// never silently swaps out the account's current program - the user
// activates it explicitly afterward, same as any other program.
export async function POST(req: Request) {
  try {
    const userId = await requireApiUserId();
    const payload = await parseJsonBody(req, programImportSchema, {
      maxBytes: 20 * 1024 * 1024,
    });

    const result = await db.$transaction(async (tx) => {
      const existing = await tx.exercise.findMany({
        where: { userId },
        select: { id: true, name: true },
      });
      const exerciseIdByName = new Map(existing.map((e) => [e.name, e.id]));

      let createdExerciseCount = 0;
      for (const e of payload.exercises) {
        if (exerciseIdByName.has(e.name)) continue;
        const created = await tx.exercise.create({
          data: {
            userId,
            name: e.name,
            muscleGroup: e.muscleGroup,
            category: e.category,
            defaultRestSec: e.defaultRestSec,
            notes: e.notes ?? null,
            usesBodyweight: e.usesBodyweight ?? false,
            equipmentType: e.equipmentType ?? 'OTHER',
          },
        });
        exerciseIdByName.set(e.name, created.id);
        createdExerciseCount += 1;
      }

      const createdPrograms: { id: string; name: string }[] = [];
      const skipped: { programName: string; workoutName: string; exerciseName: string }[] = [];

      for (const p of payload.programs) {
        const program = await tx.program.create({
          data: {
            userId,
            name: p.name,
            description: p.description ?? null,
            phase: p.phase,
            // Always inactive on import (see the function comment above).
            isActive: false,
            startDate: new Date(p.startDate),
            endDate: p.endDate ? new Date(p.endDate) : null,
          },
        });
        createdPrograms.push({ id: program.id, name: program.name });

        for (const w of p.workouts) {
          const workout = await tx.workout.create({
            data: {
              programId: program.id,
              name: w.name,
              dayOfWeek: w.dayOfWeek ?? null,
              order: w.order,
            },
          });
          for (const pe of w.exercises) {
            const exId = exerciseIdByName.get(pe.exerciseName);
            if (!exId) {
              skipped.push({
                programName: p.name,
                workoutName: w.name,
                exerciseName: pe.exerciseName,
              });
              continue;
            }
            await tx.programExercise.create({
              data: {
                workoutId: workout.id,
                exerciseId: exId,
                order: pe.order,
                targetSets: pe.targetSets,
                targetRepsMin: pe.targetRepsMin,
                targetRepsMax: pe.targetRepsMax,
                targetRIR: pe.targetRIR,
                restSec: pe.restSec,
                autoregulationMode: pe.autoregulationMode ?? 'PRESERVE_RIR',
                fatigueRate: pe.fatigueRate ?? null,
                loadAdjustmentPct: pe.loadAdjustmentPct ?? null,
                tempo: pe.tempo ?? null,
                notes: pe.notes ?? null,
                supersetGroup: pe.supersetGroup ?? null,
              },
            });
          }
        }
      }

      return { createdPrograms, createdExerciseCount, skipped };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
