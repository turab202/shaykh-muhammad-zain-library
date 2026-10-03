/**
 * GET /api/audio/[messageId]
 *
 * Streams audio directly from Telegram's CDN for a given TelegramMessage ID.
 * Looks up the telegramFileId stored in the DB, then fetches from Telegram.
 *
 * This avoids storing audio files — they stay on Telegram's servers and
 * are streamed on-demand to the listener.
 *
 * Security: only serves messages from the known channel (chatId=1747155048).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const CHANNEL_ID = "1747155048";

// Telegram Bot API — used only for file download (not for user auth).
// The bot must be a member of the channel (or the channel must be public).
// For public channels, file download works without a bot token via direct URL.
const TG_API_BASE = "https://api.telegram.org";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; // optional — needed for private channels

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;

  // Look up the TelegramMessage in DB
  const msg = await prisma.telegramMessage.findFirst({
    where: {
      chatId: CHANNEL_ID,
      messageId: parseInt(messageId, 10),
    },
    select: {
      telegramFileId: true,
      audioFilename: true,
    },
  });

  if (!msg?.telegramFileId) {
    return new NextResponse("Not found", { status: 404 });
  }

  // For public channels, we can construct a direct CDN URL
  // Format: https://api.telegram.org/file/bot{token}/{file_path}
  // First we need the file_path via getFile API
  if (!BOT_TOKEN) {
    return new NextResponse(
      "TELEGRAM_BOT_TOKEN not configured — audio proxy unavailable",
      { status: 503 }
    );
  }

  try {
    // Get the file path from Telegram
    const fileRes = await fetch(
      `${TG_API_BASE}/bot${BOT_TOKEN}/getFile?file_id=${msg.telegramFileId}`
    );
    const fileData = await fileRes.json() as {
      ok: boolean;
      result?: { file_path: string; file_size?: number };
    };

    if (!fileData.ok || !fileData.result?.file_path) {
      return new NextResponse("Could not get file from Telegram", { status: 502 });
    }

    const filePath = fileData.result.file_path;
    const audioUrl = `${TG_API_BASE}/file/bot${BOT_TOKEN}/${filePath}`;

    // Stream the audio from Telegram with range request support
    const range = req.headers.get("range");
    const headers: HeadersInit = {};
    if (range) headers["Range"] = range;

    const audioRes = await fetch(audioUrl, { headers });

    const mime = msg.audioFilename?.endsWith(".ogg")
      ? "audio/ogg"
      : msg.audioFilename?.endsWith(".m4a")
      ? "audio/mp4"
      : "audio/mpeg";

    return new NextResponse(audioRes.body, {
      status: audioRes.status,
      headers: {
        "Content-Type": mime,
        "Content-Length": audioRes.headers.get("Content-Length") ?? "",
        "Content-Range": audioRes.headers.get("Content-Range") ?? "",
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
        "Content-Disposition": `inline; filename="${msg.audioFilename ?? "audio.mp3"}"`,
      },
    });
  } catch (err) {
    console.error("Audio proxy error:", err);
    return new NextResponse("Proxy error", { status: 502 });
  }
}
