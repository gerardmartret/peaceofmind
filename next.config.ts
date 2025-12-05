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
};

export default nextConfig;
