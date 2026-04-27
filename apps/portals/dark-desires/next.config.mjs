/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://localhost:3000/api/:path*' },
    ];
  },
  env: {
    NEXT_PUBLIC_PORTAL: 'DARK_DESIRES',
    NEXT_PUBLIC_PORTAL_NAME: 'Dark Desires',
    NEXT_PUBLIC_TAGLINE: 'Forbidden • Intense • Unforgettable',
  },
};

export default nextConfig;
