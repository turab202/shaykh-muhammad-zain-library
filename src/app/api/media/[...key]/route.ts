/**
 * /api/media/[...key] — serves or redirects media from Backblaze B2 or local storage.
 *
 * URL patterns:
 *   /api/media/b2/audio/2026/file.mp3   → 302 redirect to B2 pre-signed URL
 *   /api/media/audio/2026/file.mp3      → local file (with Range support)
 *   /api/media/https://...              → absolute URL redirect
 *
 * For B2 audio: we use a PRE-SIGNED URL REDIRECT rather than proxying.
 * This lets the browser talk directly to B2 which:
 *   - Supports HTTP Range requests natively (seek works)
 *   - Has no size limits (unlike Vercel's 4.5MB serverless response limit)
 *   - Is fast (no double-hop through Vercel for every byte)
 *
 * CORS: B2 bucket has CORS rules allowing our Vercel domain (set via setup_b2_cors.py).
 * The pre-signed URL includes all auth — no credentials exposed to client.
 */
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

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

async function getB2PresignedUrl(objectKey: string): Promise<string> {
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  const endpoint = process.env.B2_ENDPOINT ?? "s3.us-east-005.backblazeb2.com";
  const region   = endpoint.split(".")[1] ?? "us-east-005";

  const client = new S3Client({
    endpoint:   `https://${endpoint}`,
    region,
    credentials: {
      accessKeyId:     process.env.B2_APPLICATION_KEY_ID ?? "",
      secretAccessKey: process.env.B2_APPLICATION_KEY     ?? "",
    },
    forcePathStyle: true,
  });

  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: process.env.B2_BUCKET_NAME ?? "", Key: objectKey }),
    { expiresIn: 3600 } // 1 hour — long enough for a full audio session
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  const storageKey = key.join("/");

  // ── Absolute URL redirect ──────────────────────────────────────────────────
  if (storageKey.startsWith("http://") || storageKey.startsWith("https://")) {
    return NextResponse.redirect(storageKey, 302);
  }

  // ── B2 private bucket — redirect to pre-signed URL ────────────────────────
  if (storageKey.startsWith("b2/")) {
    const objectKey = storageKey.slice(3); // strip "b2/" prefix
    try {
      const presignedUrl = await getB2PresignedUrl(objectKey);
      // 302 redirect — browser follows it and talks directly to B2.
      // B2 serves Range requests natively so seek/scrub works perfectly.
      return NextResponse.redirect(presignedUrl, 302);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[B2] presign error for key:", objectKey, "—", msg);
      return new NextResponse(
        JSON.stringify({ error: "B2 presign failed", detail: msg, key: objectKey }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // ── Local file (with Range support) ───────────────────────────────────────
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
  const range  = req.headers.get("range");

  if (range) {
    const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
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
