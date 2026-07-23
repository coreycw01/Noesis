import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAPACITOR_SERVER_URL || 'https://studio-4677603495-e05e8.firebaseapp.com';

const config: CapacitorConfig = {
  appId: 'com.noesis.app',
  appName: 'Noesis',
  webDir: 'capacitor-www',
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
    allowNavigation: [
      'studio-4677603495-e05e8.firebaseapp.com',
      'studio-4677603495-e05e8.web.app',
      'localhost',
      '127.0.0.1',
      '10.0.0.232',
    ],
  },
};

export default config;
