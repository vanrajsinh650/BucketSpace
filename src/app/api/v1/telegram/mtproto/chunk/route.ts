import { NextRequest, NextResponse } from 'next/server';
import { TelegramAuthService } from '@/modules/storage';

// Force this route to always be dynamic (never statically cached)
export const dynamic = 'force-dynamic';

// Increase execution timeout to 300s for large file chunk uploads
export const maxDuration = 300;

// Use the Node.js runtime (required for Buffer, GramJS, etc.)
export const runtime = 'nodejs';

/**
 * POST /api/v1/telegram/mtproto/chunk
 * Streams a binary encrypted file chunk directly to Telegram Storage Vault via MTProto.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as Blob | null;
    const chunkId = (formData.get('chunkId') as string) || '';
    const filename = (formData.get('filename') as string) || `chunk_${chunkId}.bin`;
    const targetChatId = (formData.get('targetChatId') as string) || 'vault';
    const sessionString =
      (formData.get('sessionString') as string) ||
      req.headers.get('x-telegram-session') ||
      '';

    console.log(`[chunk-upload] chunkId=${chunkId} size=${file?.size ?? 0} session=${sessionString ? 'present' : 'MISSING'}`);

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'Missing file blob in chunk upload request' },
        { status: 400 }
      );
    }

    if (!sessionString) {
      return NextResponse.json(
        { success: false, message: 'Missing Telegram session string' },
        { status: 401 }
      );
    }

    // GramJS CustomFile requires a Node Buffer. Buffer.from(arrayBuffer) is a
    // zero-copy view when possible in Node 16+, but may copy in older runtimes.
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Received empty chunk buffer — upload aborted' },
        { status: 400 }
      );
    }

    const t0 = Date.now();
    console.log(`[chunk-upload] Starting MTProto upload: chunkId=${chunkId} bufferBytes=${buffer.length}`);

    const reference = await TelegramAuthService.uploadChunk({
      sessionString,
      chunkId,
      buffer,
      filename,
      targetChatId,
    });

    const elapsed = Date.now() - t0;
    const throughputMBs = (buffer.length / 1024 / 1024 / (elapsed / 1000)).toFixed(1);
    console.log(`[chunk-upload] Done: chunkId=${chunkId} messageId=${(reference as any).messageId} elapsed=${elapsed}ms throughput=${throughputMBs}MB/s`);

    return NextResponse.json({
      success: true,
      reference,
    });
  } catch (err: any) {
    const message = err?.message || 'Failed to upload chunk to Telegram MTProto';
    console.error('[chunk-upload] ERROR:', message, err?.stack);
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/telegram/mtproto/chunk
 * Downloads and streams a binary encrypted chunk from Telegram Data Centers.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const messageId = Number(searchParams.get('messageId'));
    const targetChatId = searchParams.get('targetChatId') || 'vault';
    const channelId = searchParams.get('channelId') || undefined;
    const channelAccessHash = searchParams.get('channelAccessHash') || undefined;
    const sessionString =
      req.headers.get('x-telegram-session') ||
      '';

    if (!messageId || isNaN(messageId)) {
      return NextResponse.json(
        { success: false, message: 'Valid messageId is required' },
        { status: 400 }
      );
    }

    if (!sessionString) {
      return NextResponse.json(
        { success: false, message: 'Missing Telegram session string' },
        { status: 401 }
      );
    }

    const buffer = await TelegramAuthService.downloadChunk({
      sessionString,
      messageId,
      targetChatId,
      channelId,
      channelAccessHash,
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(buffer.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err: any) {
    const message = err?.message || 'Failed to download chunk from Telegram MTProto';
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/telegram/mtproto/chunk
 * Deletes a chunk message from Telegram Saved Messages.
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const messageId = Number(body.messageId);
    const targetChatId = body.targetChatId || 'vault';
    const sessionString =
      req.headers.get('x-telegram-session') ||
      body.sessionString ||
      '';

    if (!messageId || isNaN(messageId)) {
      return NextResponse.json(
        { success: false, message: 'Valid messageId is required' },
        { status: 400 }
      );
    }

    if (!sessionString) {
      return NextResponse.json(
        { success: false, message: 'Missing Telegram session string' },
        { status: 401 }
      );
    }

    await TelegramAuthService.deleteChunk({
      sessionString,
      messageId,
      targetChatId,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    const message = err?.message || 'Failed to delete chunk from Telegram MTProto';
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
