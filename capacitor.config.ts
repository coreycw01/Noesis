import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAPACITOR_SERVER_URL || 'https://noesis-0--studio-4677603495-e05e8.us-east4.hosted.app';
const isLocalDevelopment = /^http:\/\/(localhost|127\.0\.0\.1|10\.0\.0\.232)(:\d+)?$/i.test(serverUrl);

const config: CapacitorConfig = {
  appId: 'com.noesis.app',
  appName: 'Noesis',
  webDir: 'capacitor-www',
  server: {
    url: serverUrl,
    cleartext: isLocalDevelopment,
    allowNavigation: [
      'studio-4677603495-e05e8.firebaseapp.com',
      'studio-4677603495-e05e8.web.app',
      'noesis-0--studio-4677603495-e05e8.us-east4.hosted.app',
      ...(isLocalDevelopment ? ['localhost', '127.0.0.1', '10.0.0.232'] : []),
    ],
  },
};

export default config;
