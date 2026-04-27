/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://localhost:3000/api/:path*' },
    ];
  },
  env: {
    NEXT_PUBLIC_PORTAL: 'DESPERATE_HOUSEWIVES',
    NEXT_PUBLIC_PORTAL_NAME: 'Desperate Housewives',
    NEXT_PUBLIC_TAGLINE: 'Suburban • Seductive • Scandalous',
  },
};

export default nextConfig;
