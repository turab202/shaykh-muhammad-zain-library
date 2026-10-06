/**
 * /api/media/[...key] — serves media files from local storage or B2.
 *
 * storageKey formats:
 *   audio/2026/file.mp3        → local file (dev)
 *   s3://zain-library/audio/…  → B2 private bucket (generates pre-signed URL)
 *   https://…                  → absolute URL (redirect directly)
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

// Lazy-init B2 client (only when needed)
let _b2Client: import("@aws-sdk/client-s3").S3Client | null = null;

async function getB2Client() {
  if (_b2Client) return _b2Client;
  const { S3Client } = await import("@aws-sdk/client-s3");
  _b2Client = new S3Client({
    endpoint: `https://${process.env.B2_ENDPOINT}`,
    region: "auto",
    credentials: {
      accessKeyId:     process.env.B2_APPLICATION_KEY_ID ?? "",
      secretAccessKey: process.env.B2_APPLICATION_KEY     ?? "",
    },
  });
  return _b2Client;
}

async function b2PresignedUrl(objectKey: string): Promise<string> {
  const { getSignedUrl }   = await import("@aws-sdk/s3-request-presigner");
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const client = await getB2Client();
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

  // ── Absolute URL (external / CDN) ────────────────────────────────────────
  if (storageKey.startsWith("http://") || storageKey.startsWith("https://")) {
    return NextResponse.redirect(storageKey);
  }

  // ── B2 private bucket (s3://bucket/key) ──────────────────────────────────
  if (storageKey.startsWith("s3://")) {
    const parts    = storageKey.replace("s3://", "").split("/");
    const objectKey = parts.slice(1).join("/");
    try {
      const url = await b2PresignedUrl(objectKey);
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
    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(resolved, { start, end });
    return new NextResponse(stream as unknown as ReadableStream, {
      status: 206,
      headers: {
        "Content-Type":   mime,
        "Content-Range":  `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges":  "bytes",
        "Content-Length": String(chunkSize),
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
