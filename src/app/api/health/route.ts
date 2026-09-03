import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health
 * Render & Kubernetes liveness and readiness probe endpoint.
 * Returns HTTP 200 within <5ms without initiating Telegram authentication or chunk operations.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'bucketspace',
      timestamp: new Date().toISOString(),
      uptime: process.uptime ? Math.floor(process.uptime()) : undefined,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}

