/**
 * /api/media/[...key] — serves locally stored media files.
 *
 * storageKey format: audio/2026/filename.mp3
 * File lives at:    LOCAL_STORAGE_PATH/audio/2026/filename.mp3
 *
 * Also handles legacy absolute URLs stored as storageKey (soundhelix, etc.)
 * by redirecting directly to them.
 *
 * Security: only serves files under LOCAL_STORAGE_PATH — no path traversal.
 */
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const STORAGE_BASE = process.env.LOCAL_STORAGE_PATH
  ? path.resolve(process.env.LOCAL_STORAGE_PATH)
  : path.resolve(process.cwd(), "storage");

const MIME: Record<string, string> = {
  ".mp3":  "audio/mpeg",
  ".m4a":  "audio/mp4",
  ".aac":  "audio/aac",
  ".ogg":  "audio/ogg",
  ".wav":  "audio/wav",
  ".pdf":  "application/pdf",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png":  "image/png",
  ".webp": "image/webp",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  const storageKey = key.join("/");

  // If it looks like an absolute URL (seed data / external), redirect
  if (storageKey.startsWith("http://") || storageKey.startsWith("https://")) {
    return NextResponse.redirect(storageKey);
  }

  // Resolve and validate path — prevent traversal
  const resolved = path.resolve(STORAGE_BASE, storageKey);
  if (!resolved.startsWith(STORAGE_BASE)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(resolved)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext  = path.extname(resolved).toLowerCase();
  const mime = MIME[ext] ?? "application/octet-stream";
  const stat = fs.statSync(resolved);

  // Support Range requests for audio streaming
  const range = _req.headers.get("range");
  if (range) {
    const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
    const start = parseInt(startStr, 10);
    const end   = endStr ? parseInt(endStr, 10) : stat.size - 1;
    const chunkSize = end - start + 1;

    const stream = fs.createReadStream(resolved, { start, end });
    return new NextResponse(stream as unknown as ReadableStream, {
      status: 206,
      headers: {
        "Content-Type": mime,
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
      },
    });
  }

  const stream = fs.createReadStream(resolved);
  return new NextResponse(stream as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(stat.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
