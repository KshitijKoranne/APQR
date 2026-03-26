/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
  outputFileTracingIncludes: {
    '/api/**': ['./node_modules/better-sqlite3/**'],
  },
};

module.exports = nextConfig;
