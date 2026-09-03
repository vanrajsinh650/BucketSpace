import { NextRequest, NextResponse } from 'next/server';
import { ShareStoreService } from '@/modules/storage/share-store-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const record = await req.json();
    if (!record || !record.token) {
      return NextResponse.json({ success: false, message: 'Invalid share record' }, { status: 400 });
    }
    ShareStoreService.set(record);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || 'Failed to save share' }, { status: 500 });
  }
}
