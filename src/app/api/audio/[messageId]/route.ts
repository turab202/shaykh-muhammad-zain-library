/**
 * GET /api/audio/[messageId]
 *
 * Serves audio for a Telegram message.
 *
 * Priority:
 *  1. Local file (storageKey in suggestedMetadata) → /api/media/...
 *  2. Bot API CDN stream (if file_id cached from previous call)
 *  3. Redirect to t.me/CHANNEL/messageId (opens in Telegram)
 *
 * Note: The bot API approach requires file_ids to be pre-stored.
 * Run the importer with --store-bot-ids to populate them.
 * Until then, audio falls back to opening in the Telegram app.
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
  const telegramWebUrl = `https://t.me/${CHANNEL}/${messageId}`;

  if (isNaN(msgIdNum)) return new NextResponse("Bad request", { status: 400 });

  // Look up the lesson's telegram message
  const msg = await prisma.telegramMessage.findFirst({
    where: { chatId: CHAT_ID, messageId: msgIdNum },
    select: { suggestedMetadata: true, audioFilename: true },
  });

  if (!msg) return NextResponse.redirect(telegramWebUrl);

  const meta = msg.suggestedMetadata as Record<string, unknown> | null;

  // 1. Local storage file
  const storageKey = meta?.mediaStorageKey as string | undefined;
  if (storageKey) {
    const url = storageKey.startsWith("http")
      ? storageKey
      : new URL(`/api/media/${storageKey}`, req.url).toString();
    return NextResponse.redirect(url);
  }

  // 2. Bot API file_id (pre-stored from import)
  const botFileId = meta?.botFileId as string | undefined;
  if (botFileId && BOT_TOKEN) {
    try {
      const gf = await fetch(
        `${TG}/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(botFileId)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      const gfData = await gf.json() as { ok: boolean; result?: { file_path: string } };

      if (gfData.ok && gfData.result?.file_path) {
        const audioUrl = `${TG}/file/bot${BOT_TOKEN}/${gfData.result.file_path}`;
        const range = req.headers.get("range");
        const upstream = await fetch(audioUrl, {
          headers: range ? { Range: range } : {},
          signal: AbortSignal.timeout(30000),
        });

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
    } catch { /* fall through */ }
  }

  // 3. Fallback: open in Telegram app/web
  return NextResponse.redirect(telegramWebUrl);
}
