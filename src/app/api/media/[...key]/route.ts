/**
 * /api/media/[...key] — serves media files from local storage or Backblaze B2.
 *
 * URL patterns:
 *   /api/media/audio/2026/file.mp3     → local file
 *   /api/media/b2/audio/2026/file.mp3  → B2 private bucket (pre-signed URL)
 *   /api/media/https://...             → absolute URL (redirect)
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

async function getB2PresignedUrl(objectKey: string): Promise<string> {
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  // B2 region must match the endpoint hostname, e.g. "us-east-005" for
  // s3.us-east-005.backblazeb2.com — extract it from the endpoint env var.
  const endpoint = process.env.B2_ENDPOINT ?? "s3.us-east-005.backblazeb2.com";
  // endpoint is like "s3.us-east-005.backblazeb2.com" → region = "us-east-005"
  const region = endpoint.split(".")[1] ?? "us-east-005";

  const client = new S3Client({
    endpoint: `https://${endpoint}`,
    region,
    credentials: {
      accessKeyId:     process.env.B2_APPLICATION_KEY_ID ?? "",
      secretAccessKey: process.env.B2_APPLICATION_KEY     ?? "",
    },
    forcePathStyle: true, // B2 requires path-style access
  });

  const cmd = new GetObjectCommand({
    Bucket: process.env.B2_BUCKET_NAME ?? "",
    Key:    objectKey,
  });

  return getSignedUrl(client, cmd, { expiresIn: 3600 });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  const storageKey = key.join("/");

  // ── Absolute URL redirect ─────────────────────────────────────────────────
  if (storageKey.startsWith("http://") || storageKey.startsWith("https://")) {
    return NextResponse.redirect(storageKey);
  }

  // ── B2 private bucket ─────────────────────────────────────────────────────
  if (storageKey.startsWith("b2/")) {
    const objectKey = storageKey.slice(3); // remove "b2/" prefix
    try {
      const url = await getB2PresignedUrl(objectKey);
      // Redirect to the pre-signed URL — browser fetches audio directly from B2
      return NextResponse.redirect(url, 302);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[B2] presign error for key:", objectKey, "—", msg);
      // Return diagnostic info (non-secret) so Vercel logs are useful
      return new NextResponse(
        JSON.stringify({ error: "B2 presign failed", detail: msg, key: objectKey }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // ── Local file ────────────────────────────────────────────────────────────
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
  const range = req.headers.get("range");

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
