/**
 * GET /api/audio/[messageId]
 *
 * Streams audio via Telegram Bot API.
 *
 * Fast path (cached): uses pre-fetched file_id → getFile → stream (< 2s)
 * Slow path (fallback): forwardMessage → get file_id → getFile → stream
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const BOT_TOKEN    = process.env.TELEGRAM_BOT_TOKEN     ?? "";
const ADMIN_CHAT   = process.env.TELEGRAM_ADMIN_CHAT_ID ?? "";
const TG           = "https://api.telegram.org";

export const runtime     = "nodejs";
export const maxDuration = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;
  const msgIdNum = parseInt(messageId, 10);

  if (isNaN(msgIdNum) || !BOT_TOKEN) {
    return new NextResponse("Not configured", { status: 503 });
  }

  const msg = await prisma.telegramMessage.findFirst({
    where: { messageId: msgIdNum },
    select: { suggestedMetadata: true },
  }).catch(() => null);

  const meta         = (msg?.suggestedMetadata ?? {}) as Record<string, unknown>;
  const cachedFileId = meta.cachedFileId as string | undefined;
  const botFileId    = meta.botFileId    as string | undefined;

  // ── Fast path: cached file_id available ──────────────────────────────────
  if (cachedFileId) {
    return streamFromFileId(req, cachedFileId);
  }

  // ── Slow path: forward proxy message to get file_id ──────────────────────
  if (botFileId?.startsWith("proxy:") && ADMIN_CHAT) {
    const parts         = botFileId.split(":");
    const proxyChannelId = parts.slice(1, -1).join(":");
    const proxyMsgId    = parts[parts.length - 1];

    try {
      const fwd = await fetch(`${TG}/bot${BOT_TOKEN}/forwardMessage`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_chat_id: proxyChannelId,
          message_id:   parseInt(proxyMsgId),
          chat_id:      ADMIN_CHAT,
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

      if (fwdData.ok && fwdData.result) {
        const fileId = fwdData.result.audio?.file_id
                    ?? fwdData.result.document?.file_id
                    ?? fwdData.result.voice?.file_id;

        // Cache for next time (fire and forget)
        if (fileId) {
          prisma.telegramMessage.updateMany({
            where: { messageId: msgIdNum },
            data: {
              suggestedMetadata: {
                ...meta,
                cachedFileId: fileId,
              } as object,
            },
          }).catch(() => {});
        }

        // Delete forwarded message
        if (fwdData.result.message_id) {
          fetch(`${TG}/bot${BOT_TOKEN}/deleteMessage`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id:    ADMIN_CHAT,
              message_id: fwdData.result.message_id,
            }),
          }).catch(() => {});
        }

        if (fileId) {
          return streamFromFileId(req, fileId);
        }
      }
    } catch (err) {
      console.error("Forward error:", err);
    }
  }

  return new NextResponse("Audio not available", { status: 404 });
}

async function streamFromFileId(req: NextRequest, fileId: string): Promise<NextResponse> {
  try {
    const gf = await fetch(
      `${TG}/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await gf.json() as { ok: boolean; result?: { file_path: string } };

    if (!data.ok || !data.result?.file_path) {
      return new NextResponse("File not found", { status: 404 });
    }

    const audioUrl  = `${TG}/file/bot${BOT_TOKEN}/${data.result.file_path}`;
    const range     = req.headers.get("range");
    const upstream  = await fetch(audioUrl, {
      headers: range ? { Range: range } : {},
      signal:  AbortSignal.timeout(25000),
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
    console.error("Stream error:", err);
    return new NextResponse("Stream error", { status: 500 });
  }
}
