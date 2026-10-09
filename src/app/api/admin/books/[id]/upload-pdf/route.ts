/**
 * POST /api/admin/books/[id]/upload-pdf
 * Upload a PDF file for a book directly to B2 from the browser.
 * Requires admin session. Accepts multipart/form-data with a "file" field.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth check
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: bookId } = await params;

  // Verify book exists
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  // Parse form data
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!file.name.match(/\.(pdf|PDF)$/)) {
    return NextResponse.json({ error: "Only PDF files allowed" }, { status: 400 });
  }
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
  }

  // Upload to B2
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

    const key         = `pdfs/${file.name}`;
    const storageKey  = `s3://${bucket}/${key}`;
    const arrayBuffer = await file.arrayBuffer();

    await client.send(new PutObjectCommand({
      Bucket:      bucket,
      Key:         key,
      Body:        Buffer.from(arrayBuffer),
      ContentType: "application/pdf",
    }));

    // Upsert media record
    const existing = await prisma.media.findFirst({
      where: { bookId, mediaType: "PDF" },
    });

    if (existing) {
      await prisma.media.update({
        where: { id: existing.id },
        data: { storageKey, filename: file.name, size: file.size },
      });
    } else {
      await prisma.media.create({
        data: {
          filename:        file.name,
          mimeType:        "application/pdf",
          size:            file.size,
          mediaType:       "PDF",
          storageKey,
          storageProvider: "S3",
          bookId,
        },
      });
    }

    // Make sure book is PUBLISHED
    await prisma.book.update({
      where: { id: bookId },
      data:  { status: "PUBLISHED" },
    });

    return NextResponse.json({ ok: true, storageKey, filename: file.name });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[upload-pdf] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
