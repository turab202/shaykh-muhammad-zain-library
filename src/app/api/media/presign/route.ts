/**
 * GET /api/media/presign?key=audio/2026/file.mp3
 * Returns a short-lived B2 pre-signed URL as JSON.
 * The client sets this URL directly on <audio>.src so the browser
 * talks to B2 directly — Range requests for seeking work natively.
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing key param" }, { status: 400 });
  }

  const endpoint = process.env.B2_ENDPOINT ?? "s3.us-east-005.backblazeb2.com";
  const region   = endpoint.split(".")[1] ?? "us-east-005";
  const keyId    = process.env.B2_APPLICATION_KEY_ID ?? "";
  const appKey   = process.env.B2_APPLICATION_KEY     ?? "";
  const bucket   = process.env.B2_BUCKET_NAME         ?? "";

  if (!keyId || !appKey || !bucket) {
    return NextResponse.json({ error: "B2 not configured" }, { status: 500 });
  }

  try {
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

    const client = new S3Client({
      endpoint: `https://${endpoint}`,
      region,
      credentials: { accessKeyId: keyId, secretAccessKey: appKey },
      forcePathStyle: true,
    });

    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 7200 } // 2 hours
    );

    return NextResponse.json({ url }, {
      headers: {
        // Cache for 1 hour on CDN/browser — don't re-presign on every page load
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[presign] error for key:", key, "—", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
