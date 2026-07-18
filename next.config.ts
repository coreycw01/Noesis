import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  trailingSlash: true,

  allowedDevOrigins: [
    '10.0.0.232',
    '10.0.0.232:9002',
    '127.0.0.1',
    '127.0.0.1:9002',
    'localhost',
    'localhost:9002',
    '*.cloudworkstations.dev',
    '9000-firebase-studio-1782092587116.cluster-rbhjeem4mfgjwrkwwvustjr6em.cloudworkstations.dev',
    '6000-firebase-studio-1782092587116.cluster-rbhjeem4mfgjwrkwwvustjr6em.cloudworkstations.dev',
  ],

  turbopack: {
    root: __dirname,
  },

  images: {
    unoptimized: true,

    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
