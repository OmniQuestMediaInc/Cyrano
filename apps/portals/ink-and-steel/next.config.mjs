/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: 'http://localhost:3000/api/:path*' },
    ];
  },
  env: {
    NEXT_PUBLIC_PORTAL: 'INK_AND_STEEL',
    NEXT_PUBLIC_PORTAL_NAME: 'Ink & Steel',
    NEXT_PUBLIC_TAGLINE: 'Tattooed • Dominant • Unforgettable',
  },
};

export default nextConfig;
