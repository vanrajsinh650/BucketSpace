/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  transpilePackages: [
    '@bucketspace/shared',
    '@bucketspace/storage-adapters',
    '@bucketspace/db',
    '@bucketspace/security',
  ],
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
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiBase}/api/v1/:path*`,
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
