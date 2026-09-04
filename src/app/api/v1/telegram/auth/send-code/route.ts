import { NextRequest, NextResponse } from 'next/server';
import { TelegramAuthService } from '@/modules/storage';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone } = body;

    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return NextResponse.json(
        { success: false, message: 'Phone number is required.' },
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
      console.log('[send-code] Proxying request to cloud backend:', backendUrl);
      const targetUrl = `${backendUrl.trim().replace(/\/+$/, '')}/api/v1/telegram/auth/send-code`;
      const proxyRes = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
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

    const result = await TelegramAuthService.sendCode({
      phone: phone.trim(),
    });

    return NextResponse.json({
      success: true,
      sessionToken: result.sessionToken,
      phoneCodeHash: result.phoneCodeHash,
      isCodeViaApp: result.isCodeViaApp,
    });
  } catch (err: any) {
    const seconds = err?.seconds;
    if (seconds) {
      const mins = Math.ceil(seconds / 60);
      return NextResponse.json(
        {
          success: false,
          errorCode: 'FLOOD_WAIT',
          message: `Telegram rate limit hit. Please wait ${seconds} seconds (about ${mins} min) before requesting a new code.`,
          waitSeconds: seconds,
        },
        { status: 429 }
      );
    }

    console.error('[send-code] Error during sendCode:', err);
    return NextResponse.json(
      {
        success: false,
        message: err?.message || 'Failed to send verification code from Telegram.',
      },
      { status: 400 }
    );
  }
}
