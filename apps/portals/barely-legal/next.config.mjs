/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://localhost:3000/api/:path*' },
    ];
  },
  env: {
    NEXT_PUBLIC_PORTAL: 'BARELY_LEGAL',
    NEXT_PUBLIC_PORTAL_NAME: 'Barely Legal',
    NEXT_PUBLIC_TAGLINE: 'Fresh • Flirty • Fearless',
  },
};

export default nextConfig;
