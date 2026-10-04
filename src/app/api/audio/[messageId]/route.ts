/**
 * GET /api/audio/[messageId]
 *
 * Streams audio from Telegram for a given message ID.
 *
 * The stored telegramFileId is an MTProto document ID (not a Bot API file_id).
 * To get a Bot API file_id we call forwardMessage or use the channel's
 * message directly via getUpdates / getChatHistory.
 *
 * Strategy:
 *   1. Use Bot API: POST /getFile with the message from the PUBLIC channel
 *      via forwarding to a temp chat — but simpler: use copyMessage to a
 *      dedicated "storage" chat and get the file_id.
 *   2. Simpler alternative: call /getUpdates is not suitable for old messages.
 *      Use the channel username + message_id with the Bot API:
 *      GET https://api.telegram.org/bot{token}/getUpdates does not work for
 *      channel posts directly.
 *
 *   Best approach for public channels without storing bot file_ids:
 *   - Use the Bot API method: sendAudio / forwardMessage is a write operation.
 *   - Instead: redirect to Telegram's web preview for the message.
 *     For PUBLIC channels this gives direct browser audio playback.
 *
 *   For full streaming: store the Bot API file_id during import (future).
 *   For now: proxy via Bot API by fetching the message and extracting file_id.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const CHANNEL = "@SheikhMuhammedZain";
const CHANNEL_ID = "1747155048"; // numeric, used for Bot API
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG = "https://api.telegram.org";

// Cache: mtproto_doc_id → bot_api_file_id (in-memory, per deployment)
const fileIdCache = new Map<string, string>();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;
  const msgIdNum = parseInt(messageId, 10);
  if (isNaN(msgIdNum)) return new NextResponse("Invalid ID", { status: 400 });

  // Look up the message record
  const msg = await prisma.telegramMessage.findFirst({
    where: { chatId: CHANNEL_ID, messageId: msgIdNum },
    select: { telegramFileId: true, audioFilename: true },
  });

  if (!msg?.telegramFileId) {
    // No file info — redirect to Telegram web
    return NextResponse.redirect(`https://t.me/${CHANNEL.slice(1)}/${msgIdNum}`);
  }

  if (!BOT_TOKEN) {
    // No bot token — redirect to Telegram web (user opens in Telegram)
    return NextResponse.redirect(`https://t.me/${CHANNEL.slice(1)}/${msgIdNum}`);
  }

  // Check cache first
  let botFileId = fileIdCache.get(msg.telegramFileId);

  if (!botFileId) {
    // Use Bot API: getMessages via the channel.
    // For public channels, the bot can read messages using the channel username.
    // We call forwardMessage to get a file_id — but this writes to another chat.
    // Better: use the channel's message_id directly with copyMessage.
    // But cleanest for READ-ONLY: call the channel post via Bot API getChatHistory.

    // Actually the cleanest approach: forward the message to the bot's own chat
    // (Telegram allows this), get file_id from result, delete the forwarded message.
    // The bot's own chat_id = the bot's user ID.

    try {
      // Step 1: Get bot's own chat_id (me)
      const meRes = await fetch(`${TG}/bot${BOT_TOKEN}/getMe`);
      const meData = await meRes.json() as { ok: boolean; result?: { id: number } };
      if (!meData.ok || !meData.result) throw new Error("getMe failed");
      const botChatId = meData.result.id;

      // Step 2: Forward the channel message to the bot's own chat
      const fwdRes = await fetch(`${TG}/bot${BOT_TOKEN}/forwardMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: botChatId,
          from_chat_id: CHANNEL,
          message_id: msgIdNum,
        }),
      });
      const fwdData = await fwdRes.json() as {
        ok: boolean;
        result?: { message_id: number; document?: { file_id: string }; audio?: { file_id: string } };
      };

      if (!fwdData.ok || !fwdData.result) {
        throw new Error(`forwardMessage failed: ${JSON.stringify(fwdData)}`);
      }

      const fwdMsg = fwdData.result;
      botFileId = fwdMsg.document?.file_id ?? fwdMsg.audio?.file_id ?? "";

      if (botFileId) {
        // Cache it so we don't forward again
        fileIdCache.set(msg.telegramFileId, botFileId);

        // Delete the forwarded message (cleanup)
        await fetch(`${TG}/bot${BOT_TOKEN}/deleteMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: botChatId, message_id: fwdMsg.message_id }),
        }).catch(() => {}); // ignore deletion errors
      }
    } catch (err) {
      console.error("Audio proxy: failed to get bot file_id:", err);
      // Fall back to Telegram web redirect
      return NextResponse.redirect(`https://t.me/${CHANNEL.slice(1)}/${msgIdNum}`);
    }
  }

  if (!botFileId) {
    return NextResponse.redirect(`https://t.me/${CHANNEL.slice(1)}/${msgIdNum}`);
  }

  // Step 3: Get the actual CDN URL via getFile
  try {
    const fileRes = await fetch(`${TG}/bot${BOT_TOKEN}/getFile?file_id=${botFileId}`);
    const fileData = await fileRes.json() as {
      ok: boolean;
      result?: { file_path: string; file_size?: number };
    };

    if (!fileData.ok || !fileData.result?.file_path) {
      throw new Error("getFile failed");
    }

    const audioUrl = `${TG}/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;

    // Stream with Range support
    const range = req.headers.get("range");
    const fetchHeaders: HeadersInit = range ? { Range: range } : {};
    const audioRes = await fetch(audioUrl, { headers: fetchHeaders });

    const mime = (msg.audioFilename ?? "").endsWith(".ogg") ? "audio/ogg"
      : (msg.audioFilename ?? "").endsWith(".m4a") ? "audio/mp4"
      : "audio/mpeg";

    const resHeaders: Record<string, string> = {
      "Content-Type": mime,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    };
    const cl = audioRes.headers.get("Content-Length");
    const cr = audioRes.headers.get("Content-Range");
    if (cl) resHeaders["Content-Length"] = cl;
    if (cr) resHeaders["Content-Range"] = cr;

    return new NextResponse(audioRes.body, {
      status: audioRes.status,
      headers: resHeaders,
    });
  } catch (err) {
    console.error("Audio proxy: streaming error:", err);
    return NextResponse.redirect(`https://t.me/${CHANNEL.slice(1)}/${msgIdNum}`);
  }
}
