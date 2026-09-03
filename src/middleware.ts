import { NextRequest, NextResponse } from 'next/server';

/**
 * Production CORS & Security Middleware
 *
 * Enforces explicit Origin validation for cross-origin API requests from the Vercel frontend
 * to the Render Telegram backend. Never uses wildcard `*` for authenticated endpoints.
 */
export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin');
  const pathname = req.nextUrl.pathname;

  // Only apply CORS handling to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Determine allowed origins from environment variable (defaults to local dev origin)
  const rawAllowedOrigins = process.env.CORS_ORIGINS || 'http://localhost:3000';
  const allowedOrigins = rawAllowedOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const isOriginAllowed =
    !origin ||
    allowedOrigins.includes(origin) ||
    allowedOrigins.some((allowed) => {
      // Support subdomain wildcards like `*.vercel.app`
      if (allowed.startsWith('*.') && origin) {
        const domain = allowed.slice(2);
        try {
          const url = new URL(origin);
          return url.hostname === domain || url.hostname.endsWith('.' + domain);
        } catch {
          return false;
        }
      }
      return false;
    });

  // Handle CORS preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    if (!isOriginAllowed && origin) {
      return new NextResponse(null, { status: 403 });
    }

    const headers = new Headers();
    if (origin && isOriginAllowed) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Credentials', 'true');
    }
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, x-telegram-session, Accept, Origin'
    );
    headers.set('Access-Control-Max-Age', '86400');

    return new NextResponse(null, { status: 204, headers });
  }

  // Normal request pass-through with CORS response headers
  const res = NextResponse.next();
  if (origin && isOriginAllowed) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, x-telegram-session, Accept, Origin'
    );
  }

  return res;
}

export const config = {
  matcher: '/api/:path*',
};

