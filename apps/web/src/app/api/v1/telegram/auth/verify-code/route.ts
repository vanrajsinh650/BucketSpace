import { NextRequest, NextResponse } from 'next/server';
import { TelegramAuthService } from '@bucketspace/storage-adapters';

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
    return NextResponse.json(
      {
        success: false,
        message: err?.message || 'Invalid or expired verification code.',
      },
      { status: 400 }
    );
  }
}
