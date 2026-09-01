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

    const result = await TelegramAuthService.verify2FA({
      sessionToken: String(sessionToken).trim(),
      password: String(password),
    });

    return NextResponse.json({
      success: result.success,
      sessionString: result.sessionString,
    });
  } catch (err: any) {
    let errorMessage = err?.errorMessage || err?.message || 'Invalid 2FA password.';

    if (errorMessage.includes('PASSWORD_HASH_INVALID')) {
      errorMessage = 'Incorrect 2FA password. Please check your Telegram cloud password and try again.';
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
