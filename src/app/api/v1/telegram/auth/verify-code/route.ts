import { NextRequest, NextResponse } from 'next/server';
import { TelegramAuthService } from '@/modules/storage';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionToken, code } = body;

    if (!sessionToken || !code) {
      return NextResponse.json(
        { success: false, message: 'Session token and verification code are required.' },
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
      console.log('[verify-code] Proxying request to cloud backend:', backendUrl);
      const targetUrl = `${backendUrl.trim().replace(/\/+$/, '')}/api/v1/telegram/auth/verify-code`;
      const proxyRes = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: String(sessionToken).trim(), code: String(code).trim() }),
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

    const result = await TelegramAuthService.verifyCode({
      sessionToken: String(sessionToken).trim(),
      code: String(code).trim(),
    });

    return NextResponse.json({
      success: result.success,
      sessionString: result.sessionString,
      requires2FA: result.requires2FA,
    });
  } catch (err: any) {
    console.error('[verify-code] Error during verifyCode:', err);
    return NextResponse.json(
      {
        success: false,
        message: err?.message || 'Invalid or expired verification code.',
      },
      { status: 400 }
    );
  }
}
