import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App, URLOpenListenerEvent, AppState } from '@capacitor/app';

export interface MobileAuthResult {
  code?: string;
  error?: string;
  state?: string;
}

@Injectable({
  providedIn: 'root',
})
export class MobileAuthService {
  private readonly AUTH0_DOMAIN = 'dev-2hjdm0qn6otliqls.us.auth0.com';
  private readonly CLIENT_ID = 'Xg3Gxsm7YIddHVkM1yohO76kADkfN4Qa';
  private readonly REDIRECT_URI = this.getRedirectUri();

  private getRedirectUri(): string {
    const platform = Capacitor.getPlatform();

    if (platform === 'web') {
      return 'http://localhost:4200/callback';
    } else {
      // Use simple deep link format for both iOS and Android
      return 'com.kyrgz.translation://callback';
    }
  }

  private authResolve?: (result: MobileAuthResult) => void;
  private authReject?: (error: any) => void;

  private clearAuth0State() {
    console.log('🧹 Clearing Auth0 state to prevent conflicts');
    // Clear localStorage
    localStorage.removeItem('auth0_access_token');
    localStorage.removeItem('auth0_id_token');
    localStorage.removeItem('auth0_tokens_ready');
    localStorage.removeItem('auth0_redirect_time');
    localStorage.removeItem('auth0_error');
    localStorage.removeItem('auth0_error_description');

    // Clear any pending promises
    if (this.authReject) {
      this.authReject(new Error('Login cancelled - clearing state'));
      this.authReject = undefined;
    }
    this.authResolve = undefined;
  }

  async loginWithSocial(): Promise<MobileAuthResult> {
    console.log('🚀 MobileAuthService.loginWithSocial() called');
    console.log('📱 Platform:', Capacitor.getPlatform());
    console.log('🔗 Redirect URI:', this.REDIRECT_URI);

    if (!Capacitor.isNativePlatform()) {
      console.log('❌ Not a mobile platform');
      return { error: 'Not a mobile platform' };
    }

    // Clear any existing Auth0 state to prevent conflicts
    this.clearAuth0State();

    // Check if we have tokens from a previous web callback
    const existingToken = localStorage.getItem('auth0_access_token');
    const tokensReady = localStorage.getItem('auth0_tokens_ready');

    if (existingToken && tokensReady === 'true') {
      console.log('✅ Found existing token from web callback, using it');
      localStorage.removeItem('auth0_access_token');
      localStorage.removeItem('auth0_id_token');
      localStorage.removeItem('auth0_tokens_ready');
      localStorage.removeItem('auth0_redirect_time');
      return { code: existingToken };
    }

    // Generate random state for CSRF protection
    const state = Math.random().toString(36).substring(7);
    const nonce = Math.random().toString(36).substring(7);
    console.log('🔐 Generated state:', state);
    console.log('🔐 Generated nonce:', nonce);

    // Build Auth0 authorization URL with prompt to select account
    const authUrl =
      `https://${this.AUTH0_DOMAIN}/authorize?` +
      `client_id=${this.CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(this.REDIRECT_URI)}&` +
      `response_type=token id_token&` +
      `scope=openid profile email&` +
      `state=${state}&` +
      `nonce=${nonce}&` +
      `prompt=select_account`;

    console.log('🔐 Opening Auth0 in browser:', authUrl);

    return new Promise(async (resolve, reject) => {
      console.log('📝 Setting up Promise resolve/reject handlers');
      this.authResolve = resolve;
      this.authReject = reject;

      // Set up timeout to prevent hanging
      const timeout = setTimeout(() => {
        console.log('⏰ Auth0 login timeout - no callback received');
        if (this.authReject) {
          this.authReject(new Error('Login timeout - no callback received'));
          this.authReject = undefined;
        }
        this.authResolve = undefined;
      }, 60000); // 60 second timeout

      try {
        // Set up listener for callback - simplified approach
        console.log('👂 Setting up appUrlOpen listener...');
        const listenerHandle = await App.addListener(
          'appUrlOpen',
          (event: URLOpenListenerEvent) => {
            console.log('📱 App URL opened:', event.url);

            // Check if this is our Auth0 callback
            if (event.url.includes('com.kyrgz.translation')) {
              console.log('✅ Auth0 callback detected');

              // Clear timeout since we got a callback
              clearTimeout(timeout);

              // Close the browser
              Browser.close();

              // Parse the callback URL
              const url = new URL(event.url);
              const hash = url.hash.substring(1); // Remove the #
              const params = new URLSearchParams(hash);

              const accessToken = params.get('access_token');
              const idToken = params.get('id_token');
              const error = params.get('error');
              const returnedState = params.get('state');

              // Remove listener
              listenerHandle.remove();

              if (error) {
                console.error('❌ Auth0 error:', error);
                if (this.authReject) {
                  this.authReject(new Error(error));
                }
              } else if (accessToken && idToken && returnedState === state) {
                console.log('✅ Auth0 tokens received');

                // Store tokens
                localStorage.setItem('auth0_access_token', accessToken);
                localStorage.setItem('auth0_id_token', idToken);

                if (this.authResolve) {
                  this.authResolve({ code: accessToken, state: returnedState });
                }
              } else {
                console.error('❌ Invalid Auth0 response');
                if (this.authReject) {
                  this.authReject(new Error('Invalid authentication response'));
                }
              }
            }
          }
        );

        // Open Auth0 in system browser
        console.log('🌐 Opening browser with URL:', authUrl);
        await Browser.open({ url: authUrl, windowName: '_self' });
        console.log('✅ Browser opened successfully');
      } catch (error) {
        console.error('❌ Error in loginWithSocial:', error);
        if (this.authReject) {
          this.authReject(error);
        }
      }
    });
  }

  async getUserInfo(accessToken: string): Promise<any> {
    try {
      const response = await fetch(`https://${this.AUTH0_DOMAIN}/userinfo`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      return await response.json();
    } catch (error) {
      console.error('Error fetching user info:', error);
      throw error;
    }
  }

  logout() {
    localStorage.removeItem('auth0_access_token');
    localStorage.removeItem('auth0_id_token');
    localStorage.removeItem('auth0_tokens_ready');
    localStorage.removeItem('auth0_redirect_time');
  }

  // Check for tokens from web callback when app resumes
  checkForWebCallbackTokens(): MobileAuthResult | null {
    const existingToken = localStorage.getItem('auth0_access_token');
    const tokensReady = localStorage.getItem('auth0_tokens_ready');

    if (existingToken && tokensReady === 'true') {
      console.log('✅ Found tokens from web callback on app resume');
      localStorage.removeItem('auth0_access_token');
      localStorage.removeItem('auth0_id_token');
      localStorage.removeItem('auth0_tokens_ready');
      localStorage.removeItem('auth0_redirect_time');
      return { code: existingToken };
    }

    return null;
  }

  // Set up app state listeners for better callback handling
  setupAppStateListeners(): void {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    // Listen for app state changes
    App.addListener('appStateChange', (state: AppState) => {
      console.log(
        '📱 App state changed:',
        state.isActive ? 'active' : 'inactive'
      );

      if (state.isActive) {
        // App became active, check for callback tokens
        const callbackResult = this.checkForWebCallbackTokens();
        if (callbackResult && callbackResult.code) {
          console.log('✅ App resumed with callback tokens');
          // Emit an event or call a callback to handle the tokens
          // This will be handled by the login component
        }
      }
    });
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('auth0_access_token');
  }

  getAccessToken(): string | null {
    return localStorage.getItem('auth0_access_token');
  }
}
