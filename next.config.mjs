/** @type {import('next').NextConfig} */
const pages = [
  'about',
  'admin',
  'cancel',
  'cart',
  'checkout',
  'contact',
  'product',
  'products',
  'success',
];

const nextConfig = {
  async rewrites() {
    return [
      { source: '/', destination: '/index.html' },
      ...pages.map((page) => ({
        source: `/${page}`,
        destination: `/${page}.html`,
      })),
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
      {
        source: '/css/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }],
      },
      {
        source: '/js/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }],
      },
    ];
  },
};

export default nextConfig;
