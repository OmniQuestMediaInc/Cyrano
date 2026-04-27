/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://localhost:3000/api/:path*' },
    ];
  },
  env: {
    NEXT_PUBLIC_PORTAL: 'LOTUS_BLOOM',
    NEXT_PUBLIC_PORTAL_NAME: 'Lotus Bloom',
    NEXT_PUBLIC_TAGLINE: 'Elegant • Mysterious • Irresistible',
  },
};

export default nextConfig;
