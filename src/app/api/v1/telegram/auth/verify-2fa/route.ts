import { NextRequest, NextResponse } from 'next/server';
import { TelegramAuthService } from '@/modules/storage';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionToken, password } = body;

    if (!sessionToken || !password) {
      return NextResponse.json(
        { success: false, message: 'Session token and 2FA password are required.' },
        { status: 400 }
      );
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

    if (!hasLocalCredentials && backendUrl) {
      console.log('[verify-2fa] Proxying request to cloud backend:', backendUrl);
      const targetUrl = `${backendUrl.trim().replace(/\/+$/, '')}/api/v1/telegram/auth/verify-2fa`;
      const proxyRes = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: String(sessionToken).trim(), password: String(password) }),
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

    const result = await TelegramAuthService.verify2FA({
      sessionToken: String(sessionToken).trim(),
      password: String(password),
    });

    return NextResponse.json({
      success: result.success,
      sessionString: result.sessionString,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        message: err?.message || 'Invalid 2FA password.',
      },
      { status: 400 }
    );
  }
}
