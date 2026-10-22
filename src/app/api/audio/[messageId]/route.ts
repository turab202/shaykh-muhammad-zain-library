/**
 * GET /api/audio/[messageId]
 *
 * For lessons not yet on B2/archive.org:
 * - If TELEGRAM_BOT_TOKEN is set: streams audio via Bot API
 * - Otherwise: redirects to t.me so user can play in Telegram
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const CHANNEL   = "SheikhMuhammedZain";
const CHAT_ID   = "1747155048";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TG        = "https://api.telegram.org";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;
  const msgIdNum = parseInt(messageId, 10);

  if (isNaN(msgIdNum)) {
    return new NextResponse("Bad request", { status: 400 });
  }

  // Always works — opens lesson in Telegram
  const telegramUrl = `https://t.me/${CHANNEL}/${messageId}`;

  // If no bot token, redirect to Telegram directly
  if (!BOT_TOKEN) {
    return NextResponse.redirect(telegramUrl);
  }

  // With bot token: stream the audio directly
  const msg = await prisma.telegramMessage.findFirst({
    where: { chatId: CHAT_ID, messageId: msgIdNum },
    select: { telegramFileId: true, audioFilename: true },
  }).catch(() => null);

  if (!msg?.telegramFileId) {
    return NextResponse.redirect(telegramUrl);
  }

  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const gf    = await fetch(
      `${TG}/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(msg.telegramFileId)}`,
      { signal: ctrl.signal }
    );
    clearTimeout(timer);

    const data = await gf.json() as { ok: boolean; result?: { file_path: string } };
    if (!data.ok || !data.result?.file_path) {
      return NextResponse.redirect(telegramUrl);
    }

    const audioUrl = `${TG}/file/bot${BOT_TOKEN}/${data.result.file_path}`;
    const range    = req.headers.get("range");

    const ctrl2  = new AbortController();
    const timer2 = setTimeout(() => ctrl2.abort(), 30000);
    const upstream = await fetch(audioUrl, {
      headers: range ? { Range: range } : {},
      signal:  ctrl2.signal,
    });
    clearTimeout(timer2);

    const headers: Record<string, string> = {
      "Content-Type":  upstream.headers.get("Content-Type") ?? "audio/mpeg",
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    };
    const cl = upstream.headers.get("Content-Length");
    const cr = upstream.headers.get("Content-Range");
    if (cl) headers["Content-Length"] = cl;
    if (cr) headers["Content-Range"]  = cr;

    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch {
    return NextResponse.redirect(telegramUrl);
  }
}
