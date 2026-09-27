import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ApiError, handleApiError, requireApiUserId } from '@/lib/api';

interface Params {
  params: Promise<{ id: string }>;
}

// DELETE /api/coach/[id]: removes one weekly debrief from history. Purely a
// housekeeping action - it never touches the active program, even when the
// debrief's adjustments were already applied (that update stands on its own).
export async function DELETE(_req: Request, props: Params) {
  const params = await props.params;
  try {
    const userId = await requireApiUserId();
    const session = await db.coachSession.findFirst({ where: { id: params.id, userId } });
    if (!session) {
      throw new ApiError(404, 'Debrief not found.');
    }
    await db.coachSession.delete({ where: { id: params.id, userId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
