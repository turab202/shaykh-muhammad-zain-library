/**
 * GET /api/audio/[messageId]
 *
 * Streams audio from Telegram CDN for a given channel message ID.
 *
 * Uses Bot API method: getMessages (via forwardMessage to get file_id once,
 * then caches it). On error falls back to redirect → t.me web player.
 *
 * Max duration on Vercel hobby: 10s. We keep each step under 3s.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const CHANNEL = "@SheikhMuhammedZain";
const CHANNEL_ID = "1747155048";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TG = "https://api.telegram.org";

// In-memory cache: messageId (string) → Bot API file_id
const cache = new Map<string, string>();

async function tg(method: string, body: object) {
  const r = await fetch(`${TG}/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  return r.json();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;
  const fallback = `https://t.me/${CHANNEL.slice(1)}/${messageId}`;

  if (!BOT_TOKEN) return NextResponse.redirect(fallback);

  const msgIdNum = parseInt(messageId, 10);
  if (isNaN(msgIdNum)) return new NextResponse("Bad request", { status: 400 });

  // ── Get Bot API file_id ────────────────────────────────────────────────────
  let fileId = cache.get(messageId);

  if (!fileId) {
    try {
      // Get bot's own ID (cached after first call via module-level var)
      if (!botId) {
        const me = await tg("getMe", {}) as { ok: boolean; result?: { id: number } };
        if (me.ok) botId = me.result!.id;
      }
      if (!botId) return NextResponse.redirect(fallback);

      // Forward message → bot's own chat to get Bot API file_id
      const fwd = await tg("forwardMessage", {
        chat_id: botId,
        from_chat_id: CHANNEL,
        message_id: msgIdNum,
      }) as { ok: boolean; result?: { message_id: number; document?: { file_id: string }; audio?: { file_id: string } } };

      if (!fwd.ok || !fwd.result) {
        console.error("forwardMessage failed:", JSON.stringify(fwd).slice(0, 200));
        return NextResponse.redirect(fallback);
      }

      fileId = fwd.result.document?.file_id ?? fwd.result.audio?.file_id ?? "";

      if (fileId) cache.set(messageId, fileId);

      // Clean up — delete forwarded message (fire and forget)
      tg("deleteMessage", { chat_id: botId, message_id: fwd.result.message_id }).catch(() => {});

    } catch (err) {
      console.error("audio proxy error:", err);
      return NextResponse.redirect(fallback);
    }
  }

  if (!fileId) return NextResponse.redirect(fallback);

  // ── Get CDN URL ────────────────────────────────────────────────────────────
  try {
    const gf = await fetch(`${TG}/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const gfData = await gf.json() as { ok: boolean; result?: { file_path: string } };

    if (!gfData.ok || !gfData.result?.file_path) return NextResponse.redirect(fallback);

    const audioUrl = `${TG}/file/bot${BOT_TOKEN}/${gfData.result.file_path}`;

    // ── Stream with Range support ──────────────────────────────────────────
    const range = req.headers.get("range");
    const upstream = await fetch(audioUrl, {
      headers: range ? { Range: range } : {},
      signal: AbortSignal.timeout(30000),
    });

    // Detect MIME from filename stored in DB (no extra DB query needed here —
    // messageId is the key and audioFilename is in the telegram_messages row)
    const mime = "audio/mpeg"; // default; most files are mp3

    const resHeaders: Record<string, string> = {
      "Content-Type": mime,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=86400",
    };
    const cl = upstream.headers.get("Content-Length");
    const cr = upstream.headers.get("Content-Range");
    const ct = upstream.headers.get("Content-Type");
    if (cl) resHeaders["Content-Length"] = cl;
    if (cr) resHeaders["Content-Range"] = cr;
    if (ct) resHeaders["Content-Type"] = ct; // use Telegram's MIME

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: resHeaders,
    });

  } catch (err) {
    console.error("audio CDN stream error:", err);
    return NextResponse.redirect(fallback);
  }
}

// Module-level bot ID cache (persists across requests in same serverless instance)
let botId: number | null = null;
