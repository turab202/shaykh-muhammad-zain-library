/**
 * POST /api/admin/run-import
 *
 * Triggers the Python Telegram importer as a child process.
 * Admin-only — requires a valid session cookie.
 *
 * Body: { limit?: number, noMedia?: boolean }
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { spawn, spawnSync } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";

// Simple in-memory job store (single-process dev)
export const importJobs = new Map<string, {
  status: "running" | "done" | "error";
  log: string[];
  startedAt: Date;
  exitCode: number | null;
}>();

/** Find the Python executable that can actually run. */
function findPython(): string {
  const candidates =
    os.platform() === "win32"
      ? ["py", "python", "python3", "python3.exe", "python.exe"]
      : ["python3", "python", "python3.11", "python3.10"];

  for (const cmd of candidates) {
    try {
      const result = spawnSync(cmd, ["--version"], { timeout: 3000 });
      if (result.status === 0) return cmd;
    } catch {
      // not found
    }
  }
  throw new Error(
    "Python not found. Ensure python or py is in PATH for the Next.js server process."
  );
}

/** Resolve the project root reliably — works in both dev and prod. */
function getProjectRoot(): string {
  // __dirname in Next.js is inside .next/server — walk up to the actual root
  // Process.cwd() in `next dev` is the project root; in `next start` it may differ.
  // Use the presence of package.json as the marker.
  let dir = path.resolve(/*turbopackIgnore: true*/ process.cwd());
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    dir = path.dirname(dir);
  }
  return path.resolve(/*turbopackIgnore: true*/ process.cwd());
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { limit?: number; noMedia?: boolean };
  const limit = Math.min(Number(body.limit ?? 50), 300);
  const noMedia = body.noMedia !== false; // default true (metadata-only)

  const jobId = `import-${Date.now()}`;
  importJobs.set(jobId, { status: "running", log: [], startedAt: new Date(), exitCode: null });

  const projectRoot = getProjectRoot();
  const envFile = path.join(projectRoot, ".env");

  // Read .env vars into the child environment
  const envVars: NodeJS.ProcessEnv = { ...process.env };
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf-8").split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?/);
      if (m && m[1] && m[2] !== undefined) envVars[m[1]] = m[2];
    }
  }

  // Ensure DATABASE_URL is passed without the schema query param
  if (envVars.DATABASE_URL?.includes("?")) {
    envVars.DATABASE_URL_CLEAN = envVars.DATABASE_URL.split("?")[0];
  }

  const args = [
    "-m", "telegram.importer.importer",
    "--live",
    "--limit", String(limit),
  ];
  if (noMedia) args.push("--no-media");

  let pythonCmd: string;
  try {
    pythonCmd = findPython();
  } catch (e) {
    const job = importJobs.get(jobId)!;
    job.status = "error";
    job.log.push(String(e));
    return NextResponse.json({ jobId, status: "error", error: String(e) });
  }

  const job = importJobs.get(jobId)!;
  job.log.push(`Using Python: ${pythonCmd}`);
  job.log.push(`Project root: ${projectRoot}`);
  job.log.push(`Args: ${args.join(" ")}`);

  const child = spawn(pythonCmd, args, {
    cwd: projectRoot,
    env: envVars,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (d: Buffer) => {
    const lines = d.toString().split("\n").filter(Boolean);
    job.log.push(...lines);
    if (job.log.length > 500) job.log.splice(0, job.log.length - 500);
  });
  child.stderr.on("data", (d: Buffer) => {
    const lines = d.toString().split("\n").filter(Boolean);
    job.log.push(...lines);
    if (job.log.length > 500) job.log.splice(0, job.log.length - 500);
  });
  child.on("error", (err) => {
    job.log.push(`Spawn error: ${err.message}`);
    job.status = "error";
    job.exitCode = -1;
  });
  child.on("close", (code: number | null) => {
    job.status = code === 0 ? "done" : "error";
    job.exitCode = code;
    job.log.push(`Process exited with code ${code}`);
  });

  return NextResponse.json({ jobId, status: "running" });
}
