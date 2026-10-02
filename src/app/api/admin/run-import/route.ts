/**
 * POST /api/admin/run-import
 *
 * Triggers the Python Telegram importer as a child process.
 * Admin-only — requires a valid session cookie.
 *
 * Body: { limit?: number }
 *
 * The importer runs with --no-media (metadata only) so it finishes quickly.
 * Audio files can be downloaded later via the full import run.
 *
 * This endpoint returns immediately with a job ID and streams logs
 * via a simple polling mechanism using /api/admin/import-status/[id].
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";

// Simple in-memory job store (single-process dev; for production use Redis/DB)
export const importJobs = new Map<string, {
  status: "running" | "done" | "error";
  log: string[];
  startedAt: Date;
  exitCode: number | null;
}>();

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit ?? 50), 200);

  const jobId = `import-${Date.now()}`;
  importJobs.set(jobId, { status: "running", log: [], startedAt: new Date(), exitCode: null });

  const projectRoot = path.resolve(/*turbopackIgnore: true*/ process.cwd());
  const envFile = path.join(/*turbopackIgnore: true*/ projectRoot, ".env");

  // Read .env vars to pass to the child process
  const envVars: NodeJS.ProcessEnv = { ...process.env };
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf-8").split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?/);
      if (m) envVars[m[1]] = m[2];
    }
  }

  // Spawn Python importer as a background child process
  const pythonCmd = os.platform() === "win32" ? "py" : "python3";
  const child = spawn(
    pythonCmd,
    ["-m", "telegram.importer.importer", "--live", `--limit`, String(limit), "--no-media"],
    { cwd: projectRoot, env: envVars }
  );

  const job = importJobs.get(jobId)!;

  child.stdout?.on("data", (d: Buffer) => {
    const lines = d.toString().split("\n").filter(Boolean);
    job.log.push(...lines);
    if (job.log.length > 500) job.log.splice(0, job.log.length - 500);
  });
  child.stderr?.on("data", (d: Buffer) => {
    const lines = d.toString().split("\n").filter(Boolean);
    job.log.push(...lines);
    if (job.log.length > 500) job.log.splice(0, job.log.length - 500);
  });
  child.on("close", (code: number | null) => {
    job.status = code === 0 ? "done" : "error";
    job.exitCode = code;
  });

  return NextResponse.json({ jobId, status: "running" });
}
