/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,

  // Allow chunked file uploads up to 50MB through the App Router API routes
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },

  // Keep these heavy server-only packages out of the browser bundle
  serverExternalPackages: ['telegram', 'better-sqlite3', 'gramjs'],

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
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
