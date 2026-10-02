/**
 * GET /api/admin/import-status/[id]
 * Returns the current status and log of an import job.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { importJobs } from "../../run-import/route";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const job = importJobs.get(id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json({
    status: job.status,
    log: job.log,
    exitCode: job.exitCode,
    startedAt: job.startedAt,
  });
}
