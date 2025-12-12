import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'suppliers.drivania.com',
        pathname: '/generated/chauffeur-image/**',
      },
      {
        protocol: 'https',
        hostname: 'static.drivania.com',
        pathname: '/booking/**',
      },
    ],
  },
  // Strip console.logs in production builds
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'], // Keep console.error and console.warn for production error tracking
    } : false,
  },
};

export default nextConfig;
