/** @type {import('next').NextConfig} */
const nextConfig = {
  // API-only project — no static pages needed
  output: undefined,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
