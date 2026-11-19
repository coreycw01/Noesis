import type { NextConfig } from 'next';
import { publicProfileCacheRule } from './src/lib/public-profile-cache';

const isDevelopment = process.env.NODE_ENV !== 'production';
const contentSecurityPolicy = [
  "default-src 'self'",
  // Firebase Auth's Google API loader fetches its iframe module from this path.
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''} https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://apis.google.com/js/api.js https://apis.google.com/_/scs/abc-static/_/js/`,
  "worker-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  `connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com https://*.google.com${isDevelopment && process.env.NEXT_PUBLIC_NOESIS_LOCAL_EMULATORS === 'true' ? ' http://127.0.0.1:9198 http://127.0.0.1:8080' : ''}`,
  "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com https://www.google.com/recaptcha/",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(!isDevelopment ? ["upgrade-insecure-requests"] : []),
].join('; ');

const nextConfig: NextConfig = {
  distDir: (isDevelopment ? process.env.NOESIS_DEV_DIST_DIR : process.env.NOESIS_BUILD_DIST_DIR) || '.next',
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
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()' },
        { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ...(!isDevelopment ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
      ],
    }, {
      source: '/ocr/worker.min.js',
      headers: [{ key: 'Content-Security-Policy', value: "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' data:" }],
    }, publicProfileCacheRule, {
      source: '/api/contextual-ai',
      headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
    }];
  },
};

export default nextConfig;
