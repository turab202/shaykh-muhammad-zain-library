/**
 * DEBUG ONLY — /api/debug-b2
 * Returns B2 config state and attempts to generate a pre-signed URL.
 * DELETE THIS FILE after debugging.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const keyId     = process.env.B2_APPLICATION_KEY_ID ?? "";
  const appKey    = process.env.B2_APPLICATION_KEY     ?? "";
  const bucket    = process.env.B2_BUCKET_NAME         ?? "";
  const endpoint  = process.env.B2_ENDPOINT            ?? "";
  const storage   = process.env.STORAGE_PROVIDER       ?? "";

  // Mask secrets — show only first 6 chars
  const info = {
    B2_APPLICATION_KEY_ID: keyId  ? `${keyId.slice(0, 6)}... (${keyId.length} chars)` : "NOT SET",
    B2_APPLICATION_KEY:    appKey ? `${appKey.slice(0, 4)}... (${appKey.length} chars)` : "NOT SET",
    B2_BUCKET_NAME:        bucket  || "NOT SET",
    B2_ENDPOINT:           endpoint || "NOT SET",
    STORAGE_PROVIDER:      storage  || "NOT SET",
    region_derived:        endpoint ? endpoint.split(".")[1] : "n/a",
  };

  // Try to generate a pre-signed URL for the one known file
  let presignResult: Record<string, unknown> = { skipped: "missing credentials" };
  const testKey = "audio/2026/230_%D8%AA%D9%81%D8%B3%D9%8A%D8%B1_%D8%A7%D9%84%D8%B3%D8%B9%D8%AF%D9%8A_%D8%B3%D9%88%D8%B1%D8%A9_%D8%A5%D8%A8%D8%B1%D8%A7%D9%87%D9%8A%D9%85_%D8%A7%D9%84%D8%A2%D9%8A%D8%A9_%DB%B2%DB%B4_%DB%B3%DB%B4__59e4e406.mp3";

  if (keyId && appKey && bucket && endpoint) {
    try {
      const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
      const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

      const region = endpoint.split(".")[1] ?? "us-east-005";
      const client = new S3Client({
        endpoint:   `https://${endpoint}`,
        region,
        credentials: { accessKeyId: keyId, secretAccessKey: appKey },
        forcePathStyle: true,
      });

      // Use the actual Arabic filename from DB
      const realKey = "audio/2026/230_\u062a\u0641\u0633\u064a\u0631_\u0627\u0644\u0633\u0639\u062f\u064a_\u0633\u0648\u0631\u0629_\u0625\u0628\u0631\u0627\u0647\u064a\u0645_\u0627\u0644\u0622\u064a\u0629_\u06f2\u06f4_\u06f3\u06f4__59e4e406.mp3";

      const url = await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: bucket, Key: realKey }),
        { expiresIn: 60 }
      );

      presignResult = {
        success: true,
        urlPrefix: url.slice(0, 80) + "...",
        urlLength: url.length,
      };
    } catch (e) {
      presignResult = {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  return NextResponse.json({ env: info, presign: presignResult });
}
