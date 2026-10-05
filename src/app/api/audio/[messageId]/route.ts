/**
 * GET /api/audio/[messageId]
 *
 * Audio serving with multiple strategies:
 * 1. Local/R2 storage key → serve via /api/media
 * 2. Bot API file_id (if pre-stored) → stream from Telegram CDN
 * 3. Immediate redirect to t.me (always works, opens in Telegram)
 *
 * Strategy 3 is the current active fallback until audio files
 * are downloaded and stored in R2/local storage.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const CHANNEL = "SheikhMuhammedZain";
const CHAT_ID = "1747155048";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TG = "https://api.telegram.org";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;
  const msgIdNum = parseInt(messageId, 10);
  const telegramUrl = `https://t.me/${CHANNEL}/${messageId}`;

  if (isNaN(msgIdNum)) return new NextResponse("Bad request", { status: 400 });

  const msg = await prisma.telegramMessage.findFirst({
    where: { chatId: CHAT_ID, messageId: msgIdNum },
    select: { suggestedMetadata: true, audioFilename: true },
  }).catch(() => null);

  if (!msg) {
    return NextResponse.redirect(telegramUrl);
  }

  const meta = (msg.suggestedMetadata ?? {}) as Record<string, unknown>;

  // Strategy 1: local/R2 storage key
  const storageKey = meta.mediaStorageKey as string | undefined;
  if (storageKey) {
    const url = storageKey.startsWith("http")
      ? storageKey
      : new URL(`/api/media/${storageKey}`, req.url).toString();
    return NextResponse.redirect(url);
  }

  // Strategy 2: pre-stored Bot API file_id (fast, no forward needed)
  const botFileId = meta.botFileId as string | undefined;
  if (botFileId && BOT_TOKEN) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const gf = await fetch(
        `${TG}/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(botFileId)}`,
        { signal: ctrl.signal }
      );
      clearTimeout(timer);
      const gfData = await gf.json() as { ok: boolean; result?: { file_path: string } };

      if (gfData.ok && gfData.result?.file_path) {
        const audioUrl = `${TG}/file/bot${BOT_TOKEN}/${gfData.result.file_path}`;
        const range = req.headers.get("range");
        const ctrl2 = new AbortController();
        const timer2 = setTimeout(() => ctrl2.abort(), 25000);
        const upstream = await fetch(audioUrl, {
          headers: range ? { Range: range } : {},
          signal: ctrl2.signal,
        });
        clearTimeout(timer2);

        const headers: Record<string, string> = {
          "Content-Type": upstream.headers.get("Content-Type") ?? "audio/mpeg",
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=86400",
        };
        const cl = upstream.headers.get("Content-Length");
        const cr = upstream.headers.get("Content-Range");
        if (cl) headers["Content-Length"] = cl;
        if (cr) headers["Content-Range"] = cr;

        return new NextResponse(upstream.body, { status: upstream.status, headers });
      }
    } catch {
      // fall through to redirect
    }
  }

  // Strategy 3: redirect to Telegram (always works)
  return NextResponse.redirect(telegramUrl);
}
