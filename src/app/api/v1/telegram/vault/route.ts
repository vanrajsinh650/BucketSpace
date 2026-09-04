import { NextRequest, NextResponse } from 'next/server';
import { TelegramAuthService } from '@/modules/storage';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/v1/telegram/vault
 * Returns or provisions the hidden private '📦 BucketSpace Vault' storage channel.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionString =
      req.headers.get('x-telegram-session') ||
      '';

    if (!sessionString) {
      return NextResponse.json(
        { success: false, message: 'Missing Telegram session string' },
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
      console.log('[vault] Proxying request to cloud backend:', backendUrl);
      const targetUrl = `${backendUrl.trim().replace(/\/+$/, '')}/api/v1/telegram/vault`;
      const proxyRes = await fetch(targetUrl, {
        method: 'GET',
        headers: { 'x-telegram-session': sessionString },
      });
      const proxyData = await proxyRes.json().catch(() => ({}));
      return NextResponse.json(proxyData, { status: proxyRes.status });
    }

    const vault = await TelegramAuthService.getOrCreateStorageVault(sessionString);
    const vaultId = typeof vault === 'string' ? vault : String(vault?.id || 'vault');
    const title = typeof vault === 'string' ? 'Saved Messages' : vault?.title || '📦 BucketSpace Vault';

    return NextResponse.json({
      success: true,
      vaultId,
      title,
      archived: true,
      silent: true,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed to resolve Telegram storage vault' },
      { status: 500 }
    );
  }
}
