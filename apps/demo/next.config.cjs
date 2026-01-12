/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    externalDir: true
  },
  transpilePackages: ['@heygen/liveavatar-web-sdk']
};

module.exports = nextConfig;
