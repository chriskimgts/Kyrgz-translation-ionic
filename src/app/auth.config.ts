import { AuthConfig } from '@auth0/auth0-angular';
import { Capacitor } from '@capacitor/core';

// Determine the redirect URI based on platform
const getRedirectUri = () => {
  if (Capacitor.isNativePlatform()) {
    // For mobile apps, use app scheme with custom callback
    const platform = Capacitor.getPlatform();
    if (platform === 'ios') {
      return 'com.kyrgz.translation://dev-2hjdm0qn6otliqls.us.auth0.com/capacitor/com.kyrgz.translation/callback';
    } else if (platform === 'android') {
      return 'com.kyrgz.translation://dev-2hjdm0qn6otliqls.us.auth0.com/capacitor/com.kyrgz.translation/callback';
    }
  }
  // For web, use window origin
  return window.location.origin;
};

export const authConfig: AuthConfig = {
  domain: 'dev-2hjdm0qn6otliqls.us.auth0.com',
  clientId: 'Xg3Gxsm7YIddHVkM1yohO76kADkfN4Qa',
  authorizationParams: {
    redirect_uri: getRedirectUri(),
    audience: `https://dev-2hjdm0qn6otliqls.us.auth0.com/api/v2/`,
  },
  // Use refresh tokens for better mobile experience
  useRefreshTokens: true,
  // Cache location - use localStorage for Capacitor apps
  cacheLocation: 'localstorage' as const,
  // Use popup mode for mobile to avoid redirect issues
  ...(Capacitor.isNativePlatform() && {
    useRefreshTokensFallback: true,
  }),
};
