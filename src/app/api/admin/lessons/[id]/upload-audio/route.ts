/**
 * POST /api/admin/lessons/[id]/upload-audio
 * Upload an audio file for a lesson directly to B2 from the browser.
 * Requires admin session.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: lessonId } = await params;

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const isAudio = file.name.match(/\.(mp3|m4a|aac|ogg|wav)$/i);
  if (!isAudio) return NextResponse.json({ error: "Audio files only (mp3, m4a, aac)" }, { status: 400 });
  if (file.size > 100 * 1024 * 1024) return NextResponse.json({ error: "Max 100MB" }, { status: 400 });

  const endpoint = process.env.B2_ENDPOINT ?? "s3.us-east-005.backblazeb2.com";
  const region   = endpoint.split(".")[1] ?? "us-east-005";
  const bucket   = process.env.B2_BUCKET_NAME ?? "";
  const keyId    = process.env.B2_APPLICATION_KEY_ID ?? "";
  const appKey   = process.env.B2_APPLICATION_KEY ?? "";

  if (!bucket || !keyId || !appKey) {
    return NextResponse.json({ error: "B2 not configured" }, { status: 500 });
  }

  try {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      endpoint: `https://${endpoint}`,
      region,
      credentials: { accessKeyId: keyId, secretAccessKey: appKey },
      forcePathStyle: true,
    });

    const year       = new Date().getFullYear();
    const key        = `audio/${year}/${file.name}`;
    const storageKey = `s3://${bucket}/${key}`;
    const arrayBuffer = await file.arrayBuffer();

    await client.send(new PutObjectCommand({
      Bucket:      bucket,
      Key:         key,
      Body:        Buffer.from(arrayBuffer),
      ContentType: "audio/mpeg",
    }));

    // Duration estimate from file size (will be corrected when played)
    const durationEstimate = Math.round(file.size / (64 * 1024 / 8));

    // Upsert media record
    const existing = await prisma.media.findFirst({
      where: { lessonId, mediaType: "AUDIO" },
    });

    if (existing) {
      await prisma.media.update({
        where: { id: existing.id },
        data: { storageKey, filename: file.name, size: file.size, duration: durationEstimate },
      });
    } else {
      await prisma.media.create({
        data: {
          filename:        file.name,
          mimeType:        "audio/mpeg",
          size:            file.size,
          duration:        durationEstimate,
          mediaType:       "AUDIO",
          storageKey,
          storageProvider: "S3",
          lessonId,
        },
      });
    }

    // Update lesson duration
    await prisma.lesson.update({
      where: { id: lessonId },
      data: { duration: durationEstimate, status: "PUBLISHED" },
    });

    return NextResponse.json({ ok: true, storageKey, filename: file.name, duration: durationEstimate });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[upload-audio] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
