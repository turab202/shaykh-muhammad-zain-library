/**
 * POST /api/admin/run-import
 *
 * Triggers the Python Telegram importer as a child process.
 * Admin-only. Only works in local dev — on Vercel this returns a 503
 * directing the admin to run the importer from their local machine.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

// Simple in-memory job store
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

  // On Vercel (production) — spawning a child process is not supported.
  // Return a clear message directing the admin to the CLI.
  if (process.env.VERCEL === "1" || process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error: "CLI_REQUIRED",
        message:
          "The web import trigger only works in local development. " +
          "To import on the live site, run the importer from your local machine " +
          "with DATABASE_URL pointing to Neon:\n\n" +
          "  $env:DATABASE_URL='<neon-url>'\n" +
          "  py -m telegram.importer.importer --live --limit 3500 --auto-publish --no-media",
      },
      { status: 503 }
    );
  }

  // Local dev — spawn Python
  const body = await req.json().catch(() => ({})) as { limit?: number; noMedia?: boolean };
  const limit = Math.min(Number(body.limit ?? 50), 300);
  const noMedia = body.noMedia !== false;

  const jobId = `import-${Date.now()}`;
  importJobs.set(jobId, { status: "running", log: [], startedAt: new Date(), exitCode: null });

  // Lazy-require child_process so Turbopack doesn't trace it on Vercel
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { spawn, spawnSync } = require("child_process") as typeof import("child_process");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs") as typeof import("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path") as typeof import("path");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const os = require("os") as typeof import("os");

  const candidates = os.platform() === "win32"
    ? ["py", "python", "python3"]
    : ["python3", "python"];

  let pythonCmd = "python3";
  for (const cmd of candidates) {
    try {
      const r = spawnSync(cmd, ["--version"], { timeout: 3000 });
      if (r.status === 0) { pythonCmd = cmd; break; }
    } catch { /* skip */ }
  }

  const cwd = process.cwd();
  const envVars: NodeJS.ProcessEnv = { ...process.env };
  const envFile = path.join(cwd, ".env");
  if (fs.existsSync(envFile)) {
    for (const line of (fs.readFileSync(envFile, "utf-8") as string).split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?/);
      if (m?.[1] && m[2] !== undefined) envVars[m[1]] = m[2];
    }
  }

  const args = ["-m", "telegram.importer.importer", "--live", "--limit", String(limit)];
  if (noMedia) args.push("--no-media");

  const job = importJobs.get(jobId)!;
  job.log.push(`python: ${pythonCmd}, args: ${args.join(" ")}`);

  const child = spawn(pythonCmd, args, { cwd, env: envVars, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout?.on("data", (d: Buffer) => { job.log.push(...d.toString().split("\n").filter(Boolean)); });
  child.stderr?.on("data", (d: Buffer) => { job.log.push(...d.toString().split("\n").filter(Boolean)); });
  child.on("error", (e: Error) => { job.log.push(`Error: ${e.message}`); job.status = "error"; });
  child.on("close", (code: number | null) => { job.status = code === 0 ? "done" : "error"; job.exitCode = code; });

  return NextResponse.json({ jobId, status: "running" });
}
