/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure sql.js WASM file is included in serverless function bundles
  outputFileTracingIncludes: {
    '/api/**': ['./node_modules/sql.js/dist/sql-wasm.wasm'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't try to bundle .wasm files — they're loaded at runtime
      config.module.rules.push({
        test: /\.wasm$/,
        type: 'asset/resource',
      });
    }
    return config;
  },
};

module.exports = nextConfig;
