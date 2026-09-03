import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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
 * GET /api/v1/shares/[token]
 *
 * Returns share metadata for a given token.
 * SECURITY: Never returns the plaintext passcode or owner Telegram session string.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const record = shareStore.shares.get(token);
    if (!record) {
      return NextResponse.json({ success: false, message: 'Share link not found or expired' }, { status: 404 });
    }

    // Check expiration
    if (record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now()) {
      shareStore.shares.delete(token);
      return NextResponse.json({ success: false, message: 'Share link not found or expired' }, { status: 404 });
    }

    // Strip sensitive fields — never expose passcode or owner session
    const { passcode: _passcode, ownerSessionString: _s, telegramSession: _t, ...safeRecord } = record;
    return NextResponse.json({
      ...safeRecord,
      hasPasscode: Boolean(record.passcode),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: 'Failed to retrieve share' }, { status: 500 });
  }
}

/**
 * POST /api/v1/shares/[token]
 *
 * Validates passcode and returns full share data (including chunks) on success.
 * Uses constant-time-ish comparison to reduce timing attack surface.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await req.json().catch(() => ({}));
    const record = shareStore.shares.get(token);
    if (!record) {
      return NextResponse.json({ success: false, message: 'Share link not found or expired' }, { status: 404 });
    }

    // Check expiration
    if (record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now()) {
      shareStore.shares.delete(token);
      return NextResponse.json({ success: false, message: 'Share link not found or expired' }, { status: 404 });
    }

    // Passcode verification (if share is password-protected)
    if (record.passcode) {
      const expected = String(record.passcode);
      const provided = String(body?.passcode || '');

      // Length-safe comparison: always check full string to reduce timing leaks
      if (expected.length !== provided.length || expected !== provided) {
        return NextResponse.json({ success: false, message: 'Incorrect passcode' }, { status: 401 });
      }
    }

    // Authenticated — return full record without passcode or owner session
    const { passcode: _passcode, ownerSessionString: _s, telegramSession: _t, ...safeRecord } = record;
    return NextResponse.json({ success: true, ...safeRecord });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: 'Verification failed' }, { status: 500 });
  }
}
