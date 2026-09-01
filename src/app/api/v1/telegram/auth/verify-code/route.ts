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
    let errorMessage = err?.errorMessage || err?.message || 'Invalid or expired verification code.';

    if (errorMessage.includes('PHONE_CODE_INVALID')) {
      errorMessage = 'Invalid 5-digit code. Please check your Telegram message and enter the latest code.';
    } else if (errorMessage.includes('PHONE_CODE_EXPIRED')) {
      errorMessage = 'The verification code has expired. Please go back and request a new code.';
    }

    return NextResponse.json(
      {
        success: false,
        message: errorMessage,
      },
      { status: 400 }
    );
  }
}
