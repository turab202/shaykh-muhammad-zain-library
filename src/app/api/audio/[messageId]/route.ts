/**
 * GET /api/audio/[messageId]
 *
 * Streams audio using Telegram Bot API.
 * The bot is admin of a proxy channel containing all audio files.
 * We forward the message to get a file_id, then stream it.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const BOT_ID    = BOT_TOKEN.split(":")[0];
const TG        = "https://api.telegram.org";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;
  const msgIdNum = parseInt(messageId, 10);

  if (isNaN(msgIdNum) || !BOT_TOKEN) {
    return new NextResponse("Not available", { status: 404 });
  }

  // Look up botFileId (proxy:channel_id:msg_id)
  const msg = await prisma.telegramMessage.findFirst({
    where: { messageId: msgIdNum },
    select: { suggestedMetadata: true },
  }).catch(() => null);

  const meta      = (msg?.suggestedMetadata ?? {}) as Record<string, unknown>;
  const botFileId = meta.botFileId as string | undefined;

  if (!botFileId?.startsWith("proxy:")) {
    return new NextResponse("Audio not available", { status: 404 });
  }

  // proxy:-1003908725997:456  →  channelId=-1003908725997, msgId=456
  const lastColon     = botFileId.lastIndexOf(":");
  const proxyChannelId = botFileId.slice("proxy:".length, lastColon);
  const proxyMsgId     = botFileId.slice(lastColon + 1);

  try {
    // Forward to the admin's personal chat to get a file_id
    const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID ?? "";
    if (!ADMIN_CHAT_ID) {
      return new NextResponse("Admin chat not configured", { status: 503 });
    }

    const fwd = await fetch(`${TG}/bot${BOT_TOKEN}/forwardMessage`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        from_chat_id: proxyChannelId,
        message_id:   parseInt(proxyMsgId),
        chat_id:      ADMIN_CHAT_ID,
      }),
    });

    const fwdData = await fwd.json() as {
      ok: boolean;
      result?: {
        message_id?: number;
        audio?:    { file_id: string };
        document?: { file_id: string };
        voice?:    { file_id: string };
      };
    };

    if (!fwdData.ok || !fwdData.result) {
      return new NextResponse(`Bot error: ${JSON.stringify(fwdData)}`, { status: 502 });
    }

    const fileId = fwdData.result.audio?.file_id
                ?? fwdData.result.document?.file_id
                ?? fwdData.result.voice?.file_id;

    if (!fileId) {
      return new NextResponse("No file in forwarded message", { status: 404 });
    }

    // Delete the forwarded message from admin chat (cleanup)
    if (fwdData.result.message_id) {
      fetch(`${TG}/bot${BOT_TOKEN}/deleteMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, message_id: fwdData.result.message_id }),
      }).catch(() => {});
    }

    // Get actual file download URL
    const gf = await fetch(`${TG}/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const gfData = await gf.json() as { ok: boolean; result?: { file_path: string } };

    if (!gfData.ok || !gfData.result?.file_path) {
      return new NextResponse("Could not get file path", { status: 502 });
    }

    const audioUrl = `${TG}/file/bot${BOT_TOKEN}/${gfData.result.file_path}`;
    const range    = req.headers.get("range");

    const upstream = await fetch(audioUrl, {
      headers: range ? { Range: range } : {},
    });

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

  } catch (err) {
    console.error("Audio stream error:", err);
    return new NextResponse("Stream error", { status: 500 });
  }
}
