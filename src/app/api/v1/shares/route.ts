import { NextRequest, NextResponse } from 'next/server';
import { ShareStoreService } from '@/modules/storage/share-store-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const record = await req.json();
    if (!record || !record.token) {
      return NextResponse.json({ success: false, message: 'Invalid share record' }, { status: 400 });
    }
    const hasLocalCredentials = Boolean(
      (process.env.TELEGRAM_API_ID || process.env.TELEGRAM_APT_ID) &&
      process.env.TELEGRAM_API_HASH &&
      process.env.TELEGRAM_API_HASH !== 'your-telegram-api-hash'
    );
    const backendUrl =
      process.env.BACKEND_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'https://bucketspace-production.up.railway.app';

    if (!hasLocalCredentials && backendUrl && process.env.NODE_ENV !== 'test') {
      const targetUrl = `${backendUrl.trim().replace(/\/+$/, '')}/api/v1/shares`;
      const proxyRes = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      });
      const rawText = await proxyRes.text();
      let proxyData: any;
      try {
        proxyData = JSON.parse(rawText);
      } catch {
        proxyData = { success: false, message: rawText || `Backend returned status ${proxyRes.status}` };
      }
      return NextResponse.json(proxyData, { status: proxyRes.status });
    }

    ShareStoreService.set(record);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || 'Failed to save share' }, { status: 500 });
  }
}
