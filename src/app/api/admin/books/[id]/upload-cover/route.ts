/**
 * POST /api/admin/books/[id]/upload-cover
 * Upload a cover image for a book directly to B2.
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

  const { id: bookId } = await params;
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const isImage = file.name.match(/\.(jpg|jpeg|png|webp|gif)$/i);
  if (!isImage) return NextResponse.json({ error: "Images only (jpg, png, webp)" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Max 5MB" }, { status: 400 });

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

    // Use book slug as filename for clean URLs
    const ext       = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const key       = `covers/${book.slug}.${ext}`;
    const storageKey = `s3://${bucket}/${key}`;
    const mimeType  = file.type || "image/jpeg";
    const arrayBuffer = await file.arrayBuffer();

    await client.send(new PutObjectCommand({
      Bucket:      bucket,
      Key:         key,
      Body:        Buffer.from(arrayBuffer),
      ContentType: mimeType,
      CacheControl: "public, max-age=31536000",
    }));

    // Update book's coverImageKey
    await prisma.book.update({
      where: { id: bookId },
      data:  { coverImageKey: storageKey },
    });

    return NextResponse.json({ ok: true, storageKey, key });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[upload-cover] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
