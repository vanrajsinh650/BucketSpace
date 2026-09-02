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

    return NextResponse.json(
      {
        success: false,
        message: err?.message || 'Failed to send verification code from Telegram.',
      },
      { status: 400 }
    );
  }
}
