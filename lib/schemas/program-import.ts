import { z } from 'zod';
import { EquipmentType, ExerciseCategory, MuscleGroup } from '@/lib/prisma-client';
import { MAX_SUPERSET_GROUP, MIN_SUPERSET_GROUP } from '@/lib/supersets';

// ============================================================
// Single-program import (the counterpart to GET /api/programs/[id]/export)
// ============================================================
// Deliberately independent from app/api/backup/route.ts's importSchema: that
// route does a full-account REPLACE (wipes everything first), this one is
// purely ADDITIVE (never deletes anything). Sharing one Zod object between
// two routes with different blast radii is a coupling risk not worth the
// duplication saved - the field shapes below are kept in sync by hand and
// both ultimately describe the same exported JSON shape.

// A date string that must parse and fall within PostgreSQL's timestamp
// range, mirroring app/api/backup/route.ts's dateString.
const dateString = z
  .string()
  .max(40)
  .refine(
    (s) => {
      const t = Date.parse(s);
      if (Number.isNaN(t)) return false;
      const year = new Date(t).getUTCFullYear();
      return year >= 1 && year <= 9999;
    },
    { message: 'Invalid or out-of-range date' },
  );

export const programImportExerciseSchema = z.object({
  name: z.string().trim().min(1).max(120),
  muscleGroup: z.nativeEnum(MuscleGroup),
  category: z.nativeEnum(ExerciseCategory),
  defaultRestSec: z.number().int().min(15).max(600),
  notes: z.string().max(2000).nullable().optional(),
  usesBodyweight: z.boolean().optional(),
  equipmentType: z.nativeEnum(EquipmentType).optional(),
});

export const programImportProgramSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  phase: z.string().max(100),
  // Ignored on import (see the route): every imported program lands
  // inactive, regardless of what the file says, so it never silently
  // replaces the account's currently active program.
  isActive: z.boolean().optional(),
  startDate: dateString,
  endDate: dateString.nullable().optional(),
  workouts: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        dayOfWeek: z.number().int().min(1).max(7).nullable().optional(),
        order: z.number().int().min(0).max(1000),
        exercises: z
          .array(
            z.object({
              exerciseName: z.string().max(120),
              order: z.number().int().min(0).max(1000),
              targetSets: z.number().int().min(1).max(20),
              targetRepsMin: z.number().int().min(1).max(50),
              targetRepsMax: z.number().int().min(1).max(50),
              targetRIR: z.number().int().min(0).max(5),
              restSec: z.number().int().min(15).max(600),
              autoregulationMode: z.enum(['PRESERVE_RIR', 'PRESERVE_REPS']).optional(),
              fatigueRate: z.number().min(0.25).max(2).nullable().optional(),
              loadAdjustmentPct: z.number().min(1).max(5).nullable().optional(),
              tempo: z.string().max(20).nullable().optional(),
              notes: z.string().max(2000).nullable().optional(),
              supersetGroup: z
                .number()
                .int()
                .min(MIN_SUPERSET_GROUP)
                .max(MAX_SUPERSET_GROUP)
                .nullable()
                .optional(),
            }),
          )
          .max(200),
      }),
    )
    .max(100),
});

export const programImportSchema = z.object({
  version: z.number().int().min(1),
  exercises: z.array(programImportExerciseSchema).max(2000),
  // Typically 1 (this route's own export always emits exactly one), but a
  // hand-merged file may carry a few - capped well below the full backup's
  // 200 since this is meant for one program at a time.
  programs: z.array(programImportProgramSchema).min(1).max(20),
});

export type ProgramImportPayload = z.infer<typeof programImportSchema>;
