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

  const client = new S3Client({
    endpoint: `https://${process.env.B2_ENDPOINT}`,
    region: "auto",
    credentials: {
      accessKeyId:     process.env.B2_APPLICATION_KEY_ID ?? "",
      secretAccessKey: process.env.B2_APPLICATION_KEY     ?? "",
    },
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
      return NextResponse.redirect(url);
    } catch (e) {
      console.error("B2 presign error:", e);
      return new NextResponse("Storage error", { status: 502 });
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
