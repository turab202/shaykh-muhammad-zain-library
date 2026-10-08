/**
 * PATCH /api/lessons/[id]/duration
 * Updates the lesson duration in the DB with the real value from the audio element.
 * Called client-side after `loadedmetadata` fires so the header shows accurate time.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { duration?: number };
  const duration = typeof body.duration === "number" ? Math.round(body.duration) : null;

  if (!duration || duration < 1 || duration > 86400) {
    return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
  }

  try {
    await prisma.lesson.update({
      where: { id },
      data: { duration },
    });
    return NextResponse.json({ ok: true, duration });
  } catch {
    // Lesson not found or DB error — not critical, client ignores this
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
