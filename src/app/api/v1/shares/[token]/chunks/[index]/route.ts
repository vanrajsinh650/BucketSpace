import { NextRequest, NextResponse } from 'next/server';
import { TelegramAuthService } from '@/modules/storage';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export const runtime = 'nodejs';

interface GlobalShareStore {
  shares: Map<string, any>;
}

const globalForShares = globalThis as unknown as {
  __bucketspace_share_store?: GlobalShareStore;
};

const shareStore = globalForShares.__bucketspace_share_store || {
  shares: new Map<string, any>(),
};
globalForShares.__bucketspace_share_store = shareStore;

/**
 * GET /api/v1/shares/[token]/chunks/[index]
 *
 * Streams a raw encrypted chunk for a public share.
 * Retrieves the underlying MTProto message from Telegram Data Centers using the
 * server-held owner session string, without leaking the owner session to the recipient.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; index: string }> }
) {
  try {
    const { token, index } = await params;
    const record = shareStore.shares.get(token);

    if (!record) {
      return NextResponse.json(
        { success: false, message: 'Share link not found or expired' },
        { status: 404 }
      );
    }

    // Check expiration
    if (record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now()) {
      shareStore.shares.delete(token);
      return NextResponse.json(
        { success: false, message: 'Share link has expired' },
        { status: 410 }
      );
    }

    // Passcode validation
    if (record.passcode) {
      const url = new URL(req.url);
      const queryPasscode = url.searchParams.get('passcode');
      const headerPasscode = req.headers.get('x-share-passcode');
      const provided = queryPasscode || headerPasscode || '';

      if (!provided || provided !== String(record.passcode)) {
        return NextResponse.json(
          { success: false, message: 'Unauthorized: Valid passcode required to download this chunk' },
          { status: 401 }
        );
      }
    }

    // Resolve chunk by numeric index or chunk ID
    const chunkIdx = parseInt(index, 10);
    const chunk = Array.isArray(record.chunks)
      ? record.chunks.find((c: any, i: number) => i === chunkIdx || c.index === chunkIdx || c.id === index)
      : null;

    if (!chunk) {
      return NextResponse.json(
        { success: false, message: `Chunk '${index}' not found for share '${token}'` },
        { status: 404 }
      );
    }

    const providerId = chunk.providerRef?.providerId;

    if (providerId === 'telegram') {
      const sessionString = record.ownerSessionString || record.telegramSession;
      if (!sessionString) {
        return NextResponse.json(
          { success: false, message: 'Storage session is unavailable for this share' },
          { status: 500 }
        );
      }

      const messageId = Number(chunk.providerRef?.reference?.messageId);
      if (!messageId || isNaN(messageId)) {
        return NextResponse.json(
          { success: false, message: 'Invalid Telegram message reference for chunk' },
          { status: 400 }
        );
      }

      const refData = (chunk.providerRef?.reference || {}) as Record<string, any>;
      const targetChatId = (refData.chatId as string) || 'vault';
      const channelId = refData.channelId as string | undefined;
      const channelAccessHash = refData.channelAccessHash as string | undefined;

      const buffer = await TelegramAuthService.downloadChunk({
        sessionString,
        messageId,
        targetChatId,
        channelId,
        channelAccessHash,
      });

      return new NextResponse(new Uint8Array(buffer) as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(buffer.length),
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // In-memory fallback (for unit tests / mock environment)
    if (record.inMemoryChunks && (record.inMemoryChunks[chunkIdx] !== undefined || record.inMemoryChunks[chunk.id] !== undefined)) {
      const rawMem = record.inMemoryChunks[chunkIdx] !== undefined ? record.inMemoryChunks[chunkIdx] : record.inMemoryChunks[chunk.id];
      let uint8: Uint8Array;
      if (rawMem instanceof Uint8Array) {
        uint8 = rawMem;
      } else if (Array.isArray(rawMem)) {
        uint8 = new Uint8Array(rawMem);
      } else if (typeof rawMem === 'object' && rawMem !== null) {
        // Handle JSON serialized Uint8Array {"0": byte, "1": byte, ...}
        const values = Object.values(rawMem) as number[];
        uint8 = new Uint8Array(values);
      } else {
        uint8 = new Uint8Array(0);
      }

      return new NextResponse(uint8 as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(uint8.length),
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    return NextResponse.json(
      { success: false, message: `Unsupported provider '${providerId}' for public share chunk` },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('[share-chunk-download] Error:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed to download shared chunk' },
      { status: 500 }
    );
  }
}
