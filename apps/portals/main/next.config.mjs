/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://localhost:3000/api/:path*' },
    ];
  },
  env: {
    NEXT_PUBLIC_PORTAL: 'MAIN',
    NEXT_PUBLIC_PORTAL_NAME: 'Cyrano AI',
    NEXT_PUBLIC_TAGLINE: 'Your Perfect AI Companion',
  },
};

export default nextConfig;
