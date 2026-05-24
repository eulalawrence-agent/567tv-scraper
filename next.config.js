/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.y3cdn.com' },
    ],
  },
};

module.exports = nextConfig;
