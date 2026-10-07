/**
 * /api/media/[...key] — serves media files from local storage or Backblaze B2.
 *
 * URL patterns:
 *   /api/media/audio/2026/file.mp3     → local file (with Range support)
 *   /api/media/b2/audio/2026/file.mp3  → B2 private bucket (proxied, with Range support)
 *   /api/media/https://...             → absolute URL (redirect)
 *
 * B2 audio is PROXIED (not redirected) so the browser never talks to B2 directly.
 * This avoids all CORS issues with <audio> elements.
 */
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

// ── Node.js runtime required for streaming + AWS SDK ─────────────────────────
export const runtime = "nodejs";

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

function mimeFromKey(key: string): string {
  const ext = path.extname(key).toLowerCase();
  return MIME[ext] ?? "application/octet-stream";
}

// ── B2 client (lazy, module-level singleton) ──────────────────────────────────
let _s3Client: unknown = null;
function getS3Client() {
  if (_s3Client) return _s3Client as ReturnType<typeof buildS3Client>;
  _s3Client = buildS3Client();
  return _s3Client as ReturnType<typeof buildS3Client>;
}
function buildS3Client() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { S3Client } = require("@aws-sdk/client-s3");
  const endpoint = process.env.B2_ENDPOINT ?? "s3.us-east-005.backblazeb2.com";
  const region   = endpoint.split(".")[1] ?? "us-east-005";
  return new S3Client({
    endpoint:   `https://${endpoint}`,
    region,
    credentials: {
      accessKeyId:     process.env.B2_APPLICATION_KEY_ID ?? "",
      secretAccessKey: process.env.B2_APPLICATION_KEY     ?? "",
    },
    forcePathStyle: true,
  });
}

/**
 * Proxy a B2 object through this function, respecting Range headers.
 * Returns a streaming Response so large audio files work fine.
 */
async function proxyB2(objectKey: string, rangeHeader: string | null): Promise<Response> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GetObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
  const s3     = getS3Client();
  const bucket = process.env.B2_BUCKET_NAME ?? "";
  const mime   = mimeFromKey(objectKey);

  // ── HEAD first to get Content-Length (needed for Range responses) ──────────
  let totalSize = 0;
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
    totalSize = head.ContentLength ?? 0;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[B2] HEAD failed for", objectKey, "—", msg);
    return new Response(JSON.stringify({ error: "Object not found", key: objectKey, detail: msg }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Parse Range header ─────────────────────────────────────────────────────
  let start = 0;
  let end   = totalSize - 1;
  let isRange = false;

  if (rangeHeader && totalSize > 0) {
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (match) {
      start   = match[1] ? parseInt(match[1], 10) : 0;
      end     = match[2] ? parseInt(match[2], 10) : totalSize - 1;
      end     = Math.min(end, totalSize - 1);
      isRange = true;
    }
  }

  // ── GET from B2 with byte range ────────────────────────────────────────────
  const getParams: Record<string, unknown> = { Bucket: bucket, Key: objectKey };
  if (isRange) {
    getParams.Range = `bytes=${start}-${end}`;
  }

  let body: ReadableStream<Uint8Array>;
  try {
    const response = await s3.send(new GetObjectCommand(getParams));
    // AWS SDK v3 returns a Node.js Readable — convert to Web ReadableStream
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeStream = response.Body as any;
    body = new ReadableStream({
      start(controller) {
        nodeStream.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
        nodeStream.on("end",  ()              => controller.close());
        nodeStream.on("error", (err: Error)   => controller.error(err));
      },
      cancel() {
        nodeStream.destroy?.();
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[B2] GET failed for", objectKey, "—", msg);
    return new Response(JSON.stringify({ error: "B2 fetch failed", detail: msg }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const contentLength = isRange ? (end - start + 1) : totalSize;
  const status  = isRange ? 206 : 200;
  const headers: Record<string, string> = {
    "Content-Type":   mime,
    "Accept-Ranges":  "bytes",
    "Cache-Control":  "private, max-age=3600",
  };
  if (contentLength > 0) headers["Content-Length"] = String(contentLength);
  if (isRange) headers["Content-Range"] = `bytes ${start}-${end}/${totalSize}`;

  return new Response(body, { status, headers });
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  const storageKey  = key.join("/");
  const rangeHeader = req.headers.get("range");

  // ── Absolute URL redirect ──────────────────────────────────────────────────
  if (storageKey.startsWith("http://") || storageKey.startsWith("https://")) {
    return NextResponse.redirect(storageKey);
  }

  // ── B2 private bucket — proxied ────────────────────────────────────────────
  if (storageKey.startsWith("b2/")) {
    const objectKey = storageKey.slice(3); // strip "b2/" prefix
    return proxyB2(objectKey, rangeHeader);
  }

  // ── Local file ─────────────────────────────────────────────────────────────
  const resolved = path.resolve(STORAGE_BASE, storageKey);
  if (!resolved.startsWith(STORAGE_BASE)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (!fs.existsSync(resolved)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext    = path.extname(resolved).toLowerCase();
  const mime   = MIME[ext] ?? "application/octet-stream";
  const stat   = fs.statSync(resolved);

  if (rangeHeader) {
    const [startStr, endStr] = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(startStr, 10);
    const end   = endStr ? parseInt(endStr, 10) : stat.size - 1;
    const stream = fs.createReadStream(resolved, { start, end });
    return new NextResponse(stream as unknown as ReadableStream, {
      status: 206,
      headers: {
        "Content-Type":   mime,
        "Content-Range":  `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges":  "bytes",
        "Content-Length": String(end - start + 1),
      },
    });
  }

  const stream = fs.createReadStream(resolved);
  return new NextResponse(stream as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type":   mime,
      "Content-Length": String(stat.size),
      "Accept-Ranges":  "bytes",
      "Cache-Control":  "public, max-age=3600",
    },
  });
}
