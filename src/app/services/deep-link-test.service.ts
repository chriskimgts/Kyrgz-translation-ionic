import { Injectable } from '@angular/core';
import { Browser } from '@capacitor/browser';
import { App, URLOpenListenerEvent } from '@capacitor/app';

@Injectable({
  providedIn: 'root',
})
export class DeepLinkTestService {
  async testIOSDeepLink(): Promise<void> {
    console.log('🧪 Testing iOS deep link - simple version...');

    try {
      await Browser.open({ url: 'https://www.google.com' });
      alert('✅ Browser opened successfully!');
    } catch (error) {
      alert('❌ Browser failed: ' + error);
    }
  }

  async testIOSAuth0DeepLink(): Promise<void> {
    console.log('🧪 Testing iOS Auth0 deep link with deep link handling...');

    // Generate random state and nonce for security
    const state = Math.random().toString(36).substring(7);
    const nonce = Math.random().toString(36).substring(7);

    // Auth0 URL with proper deep link handling
    const authUrl =
      'https://dev-2hjdm0qn6otliqls.us.auth0.com/authorize?' +
      'client_id=Xg3Gxsm7YIddHVkM1yohO76kADkfN4Qa&' +
      'redirect_uri=com.kyrgz.translation%3A%2F%2Fdev-2hjdm0qn6otliqls.us.auth0.com%2Fcapacitor%2Fcom.kyrgz.translation%2Fcallback&' +
      'response_type=token%20id_token&' +
      'scope=openid%20profile%20email&' +
      'state=' +
      state +
      '&' +
      'nonce=' +
      nonce +
      '&' +
      'prompt=select_account';

    console.log('🔗 Auth0 URL:', authUrl);

    try {
      // Set up listener for deep link callback
      const listenerHandle = await App.addListener(
        'appUrlOpen',
        (event: URLOpenListenerEvent) => {
          console.log('✅ Deep link received:', event.url);

          if (event.url.includes('com.kyrgz.translation')) {
            Browser.close();

            // Parse the callback URL to get tokens
            const url = new URL(event.url);
            const hash = url.hash.substring(1); // Remove the #
            const params = new URLSearchParams(hash);

            const accessToken = params.get('access_token');
            const idToken = params.get('id_token');
            const error = params.get('error');
            const returnedState = params.get('state');

            if (error) {
              console.error('❌ Auth0 error:', error);
              alert('❌ Auth0 error: ' + error);
            } else if (accessToken && idToken && returnedState === state) {
              console.log('✅ Auth0 tokens received');

              // Store tokens
              localStorage.setItem('auth0_access_token', accessToken);
              localStorage.setItem('auth0_id_token', idToken);

              alert('✅ Auth0 login SUCCESS! Tokens stored.');
            } else {
              console.error('❌ Invalid Auth0 response');
              alert('❌ Invalid Auth0 response');
            }

            listenerHandle.remove();
          }
        }
      );

      // Open Auth0 in browser
      await Browser.open({ url: authUrl });
      alert('✅ Auth0 browser opened! Try logging in.');
    } catch (error) {
      alert('❌ Auth0 test failed: ' + error);
    }
  }
}
