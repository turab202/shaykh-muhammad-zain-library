/**
 * DEBUG — /api/debug-b2
 * Tests B2 connectivity: env vars, HEAD request timing, small byte range fetch.
 * DELETE after debugging.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  const keyId    = process.env.B2_APPLICATION_KEY_ID ?? "";
  const appKey   = process.env.B2_APPLICATION_KEY     ?? "";
  const bucket   = process.env.B2_BUCKET_NAME         ?? "";
  const endpoint = process.env.B2_ENDPOINT            ?? "";

  const env = {
    B2_APPLICATION_KEY_ID: keyId   ? `${keyId.slice(0,6)}... (${keyId.length}c)`   : "NOT SET",
    B2_APPLICATION_KEY:    appKey  ? `${appKey.slice(0,4)}... (${appKey.length}c)`  : "NOT SET",
    B2_BUCKET_NAME:        bucket  || "NOT SET",
    B2_ENDPOINT:           endpoint || "NOT SET",
    STORAGE_PROVIDER:      process.env.STORAGE_PROVIDER || "NOT SET",
  };

  if (!keyId || !appKey || !bucket || !endpoint) {
    return NextResponse.json({ env, error: "Missing B2 credentials" }, { status: 500 });
  }

  const { S3Client, HeadObjectCommand, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const region = endpoint.split(".")[1] ?? "us-east-005";
  const s3 = new S3Client({
    endpoint: `https://${endpoint}`,
    region,
    credentials: { accessKeyId: keyId, secretAccessKey: appKey },
    forcePathStyle: true,
  });

  const key = "audio/2026/230_\u062a\u0641\u0633\u064a\u0631_\u0627\u0644\u0633\u0639\u062f\u064a_\u0633\u0648\u0631\u0629_\u0625\u0628\u0631\u0627\u0647\u064a\u0645_\u0627\u0644\u0622\u064a\u0629_\u06f2\u06f4_\u06f3\u06f4__59e4e406.mp3";

  // Test 1: HEAD
  let headMs = 0, totalSize = 0, headError = "";
  try {
    const t0 = Date.now();
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    headMs    = Date.now() - t0;
    totalSize = head.ContentLength ?? 0;
  } catch (e) {
    headError = e instanceof Error ? e.message : String(e);
  }

  // Test 2: GET first 4KB (simulates what <audio> does to read ID3 headers)
  let getMs = 0, bytesRead = 0, getError = "";
  if (!headError) {
    try {
      const t0 = Date.now();
      const resp = await s3.send(new GetObjectCommand({
        Bucket: bucket, Key: key, Range: "bytes=0-4095",
      }));
      getMs = Date.now() - t0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chunks: Buffer[] = [];
      for await (const chunk of resp.Body as any) chunks.push(Buffer.from(chunk));
      bytesRead = chunks.reduce((n, c) => n + c.length, 0);
    } catch (e) {
      getError = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json({
    env,
    head: headError ? { error: headError } : { ok: true, ms: headMs, totalSize },
    get:  getError  ? { error: getError  } : { ok: true, ms: getMs,  bytesRead },
    audioUrl: `/api/media/b2/${key}`,
  });
}
