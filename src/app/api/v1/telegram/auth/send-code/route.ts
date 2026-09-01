import { NextRequest, NextResponse } from 'next/server';
import { TelegramAuthService } from '@/modules/storage';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, apiId, apiHash } = body;

    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return NextResponse.json(
        { success: false, message: 'Phone number is required.' },
        { status: 400 }
      );
    }

    const parsedApiId =
      apiId !== undefined && String(apiId).trim() !== ''
        ? Number(apiId)
        : undefined;
    const parsedApiHash =
      apiHash !== undefined && String(apiHash).trim() !== ''
        ? String(apiHash).trim()
        : undefined;

    const result = await TelegramAuthService.sendCode({
      phone: phone.trim(),
      apiId: parsedApiId,
      apiHash: parsedApiHash,
    });

    return NextResponse.json({
      success: true,
      sessionToken: result.sessionToken,
      phoneCodeHash: result.phoneCodeHash,
      isCodeViaApp: result.isCodeViaApp,
    });
  } catch (err: any) {
    let errorMessage = err?.errorMessage || err?.message || 'Failed to send verification code from Telegram.';

    if (errorMessage.includes('PHONE_NUMBER_INVALID')) {
      errorMessage = 'Invalid phone number format. Please include your country code (e.g. +91 8320452875).';
    } else if (errorMessage.includes('PHONE_NUMBER_UNREGISTERED')) {
      errorMessage = 'This phone number is not registered on Telegram. Please create an account on Telegram first.';
    } else if (errorMessage.includes('API_ID_INVALID') || errorMessage.includes('API_ID_PUBLISHED_FLOOD')) {
      errorMessage = 'Telegram API ID is invalid or busy. You can provide your custom API ID from my.telegram.org in custom credentials.';
    } else if (errorMessage.includes('FLOOD_WAIT') || err?.seconds) {
      const waitSeconds = err?.seconds || 60;
      const mins = Math.ceil(waitSeconds / 60);
      return NextResponse.json(
        {
          success: false,
          errorCode: 'FLOOD_WAIT',
          message: `Telegram rate limit reached. Please wait ${waitSeconds} seconds (about ${mins} min) before requesting another code.`,
          waitSeconds,
        },
        { status: 429 }
      );
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
