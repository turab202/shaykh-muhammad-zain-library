/**
 * GET /api/audio/[messageId]
 *
 * Streams audio directly from Telegram's CDN for a given Telegram message ID.
 *
 * Strategy (no Bot token required for public channels):
 *   1. If TELEGRAM_BOT_TOKEN is set: use getFile API → CDN URL
 *   2. If not set: redirect to Telegram's public web URL
 *      t.me/SheikhMuhammedZain/{messageId} opens in Telegram web
 *      The browser/player can fetch the file directly.
 *
 * The telegramFileId stored in the DB is used with the Bot API.
 * For public channels, files are accessible via the bot even without
 * the user being a member.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const CHANNEL_USERNAME = "SheikhMuhammedZain";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_API = "https://api.telegram.org";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;
  const msgIdNum = parseInt(messageId, 10);
  if (isNaN(msgIdNum)) {
    return new NextResponse("Invalid message ID", { status: 400 });
  }

  // Look up the TelegramMessage record
  const msg = await prisma.telegramMessage.findFirst({
    where: { chatId: "1747155048", messageId: msgIdNum },
    select: { telegramFileId: true, audioFilename: true },
  });

  if (!msg) {
    return new NextResponse("Message not found", { status: 404 });
  }

  // ── Strategy 1: Bot API (best — full streaming with Range support) ────────
  if (BOT_TOKEN && msg.telegramFileId) {
    try {
      const fileRes = await fetch(
        `${TG_API}/bot${BOT_TOKEN}/getFile?file_id=${msg.telegramFileId}`,
        { next: { revalidate: 3600 } }
      );
      const fileData = await fileRes.json() as {
        ok: boolean;
        result?: { file_path: string };
      };

      if (fileData.ok && fileData.result?.file_path) {
        const audioUrl = `${TG_API}/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
        const range = req.headers.get("range");
        const fetchHeaders: HeadersInit = range ? { Range: range } : {};

        const audioRes = await fetch(audioUrl, { headers: fetchHeaders });

        const mime = msg.audioFilename?.endsWith(".ogg") ? "audio/ogg"
          : msg.audioFilename?.endsWith(".m4a") ? "audio/mp4"
          : "audio/mpeg";

        const responseHeaders: Record<string, string> = {
          "Content-Type": mime,
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=3600",
        };
        const cl = audioRes.headers.get("Content-Length");
        const cr = audioRes.headers.get("Content-Range");
        if (cl) responseHeaders["Content-Length"] = cl;
        if (cr) responseHeaders["Content-Range"] = cr;
        if (msg.audioFilename) {
          responseHeaders["Content-Disposition"] = `inline; filename="${msg.audioFilename}"`;
        }

        return new NextResponse(audioRes.body, {
          status: audioRes.status,
          headers: responseHeaders,
        });
      }
    } catch (err) {
      console.error("Bot API audio proxy error:", err);
      // fall through to redirect strategy
    }
  }

  // ── Strategy 2: Redirect to Telegram web (works for public channels) ──────
  // The browser opens the Telegram web player for this specific message.
  // Audio playback works via Telegram's own web interface.
  const tgWebUrl = `https://t.me/${CHANNEL_USERNAME}/${msgIdNum}`;
  return NextResponse.redirect(tgWebUrl, { status: 302 });
}
