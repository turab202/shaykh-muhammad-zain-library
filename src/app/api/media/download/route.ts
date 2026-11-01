/**
 * GET /api/media/download?key=pdfs/book.pdf&name=filename.pdf
 *
 * Proxies a B2/archive.org file with Content-Disposition: attachment
 * so mobile browsers download it instead of opening in-browser.
 */
import { NextRequest, NextResponse } from "next/server";

export const runtime     = "nodejs";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const key      = req.nextUrl.searchParams.get("key");
  const filename = req.nextUrl.searchParams.get("name") ?? "download.pdf";

  if (!key) {
    return new NextResponse("Missing key", { status: 400 });
  }

  // Build the actual file URL
  let fileUrl: string;

  if (key.startsWith("https://")) {
    fileUrl = key;
  } else if (key.startsWith("s3://")) {
    // B2: s3://bucket/path → presign via existing media route
    const objectKey = key.split("/").slice(3).join("/");
    const presignUrl = new URL(`/api/media/presign`, req.url);
    presignUrl.searchParams.set("key", objectKey);

    const presignRes = await fetch(presignUrl.toString());
    if (!presignRes.ok) {
      return new NextResponse("Could not get download URL", { status: 502 });
    }
    const { url } = await presignRes.json() as { url?: string };
    if (!url) return new NextResponse("No URL", { status: 502 });
    fileUrl = url;
  } else {
    fileUrl = new URL(`/api/media/${key}`, req.url).toString();
  }

  try {
    const upstream = await fetch(fileUrl, {
      signal: AbortSignal.timeout(25000),
    });

    if (!upstream.ok) {
      return new NextResponse("File not found", { status: upstream.status });
    }

    const safeFilename = filename.replace(/[^\w.\- ]/g, "_");
    const headers: Record<string, string> = {
      "Content-Type":        upstream.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
      "Cache-Control":       "public, max-age=3600",
    };
    const cl = upstream.headers.get("Content-Length");
    if (cl) headers["Content-Length"] = cl;

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (err) {
    console.error("Download proxy error:", err);
    return new NextResponse("Download error", { status: 500 });
  }
}
