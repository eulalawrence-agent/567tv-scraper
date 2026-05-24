const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS' },
        ],
      },
    ];
  },
  // Exclude playwright from bundle (use at runtime only)
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('playwright-core', '@sparticuz/chromium');
    }
    return config;
  },
};

module.exports = nextConfig;
