/**
 * POST /api/admin/series/[id]/upload-cover
 * Upload a cover image for a series directly to B2.
 * Requires admin session.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: seriesId } = await params;
  const series = await prisma.series.findUnique({ where: { id: seriesId } });
  if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });

  const isImage = file.name.match(/\.(jpg|jpeg|png|webp|gif)$/i);
  if (!isImage) return NextResponse.json({ error: "Images only (jpg, png, webp)" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Max 5MB" }, { status: 400 });

  const endpoint = process.env.B2_ENDPOINT ?? "s3.us-east-005.backblazeb2.com";
  const region = endpoint.split(".")[1] ?? "us-east-005";
  const bucket = process.env.B2_BUCKET_NAME ?? "";
  const keyId = process.env.B2_APPLICATION_KEY_ID ?? "";
  const appKey = process.env.B2_APPLICATION_KEY ?? "";

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

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const key = `covers/series-${series.slug}.${ext}`;
    const storageKey = `s3://${bucket}/${key}`;

    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type || "image/jpeg",
      CacheControl: "public, max-age=31536000",
    }));

    await prisma.series.update({
      where: { id: seriesId },
      data: { coverImageKey: storageKey },
    });

    return NextResponse.json({ ok: true, storageKey, key });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[upload-series-cover] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
