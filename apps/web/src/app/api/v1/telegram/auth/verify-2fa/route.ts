import { NextRequest, NextResponse } from 'next/server';
import { TelegramAuthService } from '@bucketspace/storage-adapters';

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
    return NextResponse.json(
      {
        success: false,
        message: err?.message || 'Invalid 2FA password.',
      },
      { status: 400 }
    );
  }
}
