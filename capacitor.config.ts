import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kyrgz.translation',
  appName: 'Kyrgz-translation-ionic',
  webDir: 'www',
  plugins: {
    Browser: {
      // Configure browser plugin for OAuth
    },
  },
  // Deep linking for Auth0 OAuth
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
};

export default config;
