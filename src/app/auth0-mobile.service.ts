import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';

@Injectable({
  providedIn: 'root',
})
export class Auth0MobileService {
  private auth0 = inject(Auth0Service);

  async loginWithRedirect() {
    if (Capacitor.isNativePlatform()) {
      // Mobile: Use Capacitor Browser for OAuth
      console.log('📱 Mobile Auth0 login starting...');

      // Build the Auth0 authorization URL
      const domain = 'dev-2hjdm0qn6otliqls.us.auth0.com';
      const clientId = 'Xg3Gxsm7YIddHVkM1yohO76kADkfN4Qa';
      const redirectUri = `com.kyrgz.translation://dev-2hjdm0qn6otliqls.us.auth0.com/capacitor/com.kyrgz.translation/callback`;

      const authUrl =
        `https://${domain}/authorize?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=openid%20profile%20email`;

      console.log('🔗 Opening Auth0 in browser:', authUrl);

      // Open Auth0 in system browser
      await Browser.open({ url: authUrl, windowName: '_self' });

      // Listen for the callback
      Browser.addListener('browserFinished', () => {
        console.log('✅ Browser finished - checking authentication');
      });
    } else {
      // Web: Use standard Auth0 redirect
      console.log('🌐 Web Auth0 login starting...');
      this.auth0.loginWithRedirect();
    }
  }

  async handleCallback(url: string) {
    console.log('📲 Handling Auth0 callback:', url);
    // Extract the code from the callback URL
    const code = new URL(url).searchParams.get('code');
    if (code) {
      console.log('✅ Authorization code received:', code);
      // Exchange code for tokens (would need backend endpoint)
      // For now, we'll use the web-based flow
    }
  }
}
