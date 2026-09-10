import { NextRequest, NextResponse } from 'next/server';
import { ShareStoreService } from '@/modules/storage/share-store-service';
import { TelegramSessionRegistry } from '@/modules/storage/telegram-session-registry';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const record = await req.json();
    if (!record || !record.token) {
      return NextResponse.json({ success: false, message: 'Invalid share record' }, { status: 400 });
    }

    // Extract session from header or legacy body fields
    const sessionFromHeader = req.headers.get('x-telegram-session');
    const legacySession = record.ownerSessionString || record.telegramSession;
    const sessionToRegister =
      (sessionFromHeader && sessionFromHeader.trim()) ||
      (typeof legacySession === 'string' && legacySession.trim()) ||
      undefined;

    if (sessionToRegister) {
      const ref = TelegramSessionRegistry.register(sessionToRegister);
      record.ownerProviderRef = ref;
    }

    // HARDENING: Strictly remove any legacy raw session fields
    delete record.ownerSessionString;
    delete record.telegramSession;

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
      const proxyHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sessionToRegister) {
        proxyHeaders['x-telegram-session'] = sessionToRegister;
      }
      const proxyRes = await fetch(targetUrl, {
        method: 'POST',
        headers: proxyHeaders,
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

