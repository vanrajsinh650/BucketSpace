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

export async function POST(req: NextRequest) {
  try {
    const record = await req.json();
    if (!record || !record.token) {
      return NextResponse.json({ success: false, message: 'Invalid share record' }, { status: 400 });
    }
    shareStore.shares.set(record.token, record);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || 'Failed to save share' }, { status: 500 });
  }
}
