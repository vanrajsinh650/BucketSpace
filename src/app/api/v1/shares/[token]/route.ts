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
    return NextResponse.json(record);
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || 'Failed to get share' }, { status: 500 });
  }
}
