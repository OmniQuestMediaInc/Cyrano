/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Cyrano Layer 2 talks to the platform via the core API; never directly to
  // the monorepo's Prisma client. CORS for the staging API is handled by the
  // platform's reverse proxy.
  async rewrites() {
    return [
      {
        source: '/api/cyrano/:path*',
        destination: `${process.env.CYRANO_CORE_API_URL ?? 'http://localhost:3000'}/cyrano/:path*`,
      },
      {
        source: '/api/sensync/:path*',
        destination: `${process.env.CYRANO_CORE_API_URL ?? 'http://localhost:3000'}/sensync/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
