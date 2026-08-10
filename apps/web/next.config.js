/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        crypto: false,
        path: false,
        os: false,
        stream: false,
      };
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          const mod = resource.request.replace(/^node:/, '');
          if (['fs', 'crypto', 'path', 'os', 'stream'].includes(mod)) {
            resource.request = 'path'; // harmless fallback module or empty
          }
        })
      );
    }
    return config;
  },
};

module.exports = nextConfig;
