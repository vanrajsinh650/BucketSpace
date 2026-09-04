/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,

  // Allow chunked file uploads up to 50MB through Server Actions
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },

  // Keep these heavy server-only packages out of the browser bundle
  serverExternalPackages: ['telegram', 'better-sqlite3', 'gramjs'],

  async rewrites() {
    // If this instance is the direct Telegram backend (e.g. Railway or local fullstack with credentials),
    // it serves the endpoints directly without proxying.
    const isDirectBackend = Boolean(
      process.env.TELEGRAM_API_ID ||
      process.env.TELEGRAM_APT_ID ||
      process.env.RAILWAY_ENVIRONMENT ||
      process.env.RAILWAY_PROJECT_ID
    );
    if (isDirectBackend && !process.env.BACKEND_API_URL) {
      return [];
    }

    const backendUrl =
      process.env.BACKEND_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'https://bucketspace-production.up.railway.app';
    const cleanBackend = backendUrl.trim().replace(/\/+$/, '');

    return {
      beforeFiles: [
        {
          source: '/api/v1/telegram/:path*',
          destination: `${cleanBackend}/api/v1/telegram/:path*`,
        },
        {
          source: '/api/v1/shares/:path*',
          destination: `${cleanBackend}/api/v1/shares/:path*`,
        },
        {
          source: '/api/health',
          destination: `${cleanBackend}/api/health`,
        },
      ],
    };
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' blob: data: https:",
              "font-src 'self' data: https:",
              "connect-src 'self' https: http: blob: data:",
              "media-src 'self' blob: data:",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        crypto: false,
        path: false,
        os: false,
        net: false,
        tls: false,
        child_process: false,
        stream: false,
        'stream/promises': false,
        util: false,
        chokidar: false,
        readdirp: false,
        fsevents: false,
      };
      config.resolve.alias = {
        ...config.resolve.alias,
        'stream/promises': false,
        'node:stream/promises': false,
        'node:stream': false,
        'node:fs': false,
        'node:crypto': false,
        'node:path': false,
        'node:os': false,
        'node:net': false,
        'node:tls': false,
        'node:child_process': false,
        'node:util': false,
        chokidar: false,
        readdirp: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
