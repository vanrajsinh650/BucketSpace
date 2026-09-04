import { NextRequest, NextResponse } from 'next/server';
import { TelegramAuthService } from '@/modules/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/v1/telegram/vault/sync
 * Discovers and reconstructs all files and chunk mappings stored in the user's Telegram vault.
 */
export async function GET(req: NextRequest) {
  try {
    const sessionString =
      req.headers.get('x-telegram-session') ||
      req.nextUrl.searchParams.get('session') ||
      '';

    if (!sessionString) {
      return NextResponse.json(
        { success: false, message: 'Missing Telegram session string in request' },
        { status: 401 }
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
      console.log('[vault-sync] Proxying GET to cloud backend:', backendUrl);
      const targetUrl = `${backendUrl.trim().replace(/\/+$/, '')}/api/v1/telegram/vault/sync`;
      const proxyRes = await fetch(targetUrl, {
        method: 'GET',
        headers: { 'x-telegram-session': sessionString },
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

    const files = await TelegramAuthService.syncVaultFiles(sessionString);

    return NextResponse.json({
      success: true,
      files,
      count: files.length,
    });
  } catch (err: any) {
    console.error('[vault-sync] GET error:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed syncing files from Telegram vault' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/telegram/vault/sync
 * Persists the current files registry manifest into the user's private Telegram vault channel.
 */
export async function POST(req: NextRequest) {
  try {
    const sessionString =
      req.headers.get('x-telegram-session') ||
      '';

    if (!sessionString) {
      return NextResponse.json(
        { success: false, message: 'Missing Telegram session string in request' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const files = body.files;

    if (!Array.isArray(files)) {
      return NextResponse.json(
        { success: false, message: 'Invalid payload: files array is required' },
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
      console.log('[vault-sync] Proxying POST to cloud backend:', backendUrl);
      const targetUrl = `${backendUrl.trim().replace(/\/+$/, '')}/api/v1/telegram/vault/sync`;
      const proxyRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-session': sessionString,
        },
        body: JSON.stringify({ files }),
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

    const saved = await TelegramAuthService.saveVaultRegistry(sessionString, files);

    return NextResponse.json({
      success: saved,
    });
  } catch (err: any) {
    console.error('[vault-sync] POST error:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed saving files registry to Telegram vault' },
      { status: 500 }
    );
  }
}
