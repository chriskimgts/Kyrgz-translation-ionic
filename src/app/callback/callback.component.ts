import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

@Component({
  selector: 'app-callback',
  template: `
    <div class="flex items-center justify-center min-h-screen bg-gray-50">
      <div class="text-center">
        <div
          class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"
        ></div>
        <h2 class="text-xl font-semibold text-gray-900 mb-2">
          Processing Authentication...
        </h2>
        <p class="text-gray-600">Please wait while we complete your login.</p>
      </div>
    </div>
  `,
  styles: [],
  standalone: false,
})
export class CallbackComponent implements OnInit {
  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    console.log('🔗 Callback page loaded');

    // Get the URL fragment (hash) which contains the Auth0 tokens
    const fragment = window.location.hash.substring(1);
    const params = new URLSearchParams(fragment);

    const accessToken = params.get('access_token');
    const idToken = params.get('id_token');
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    console.log('🔗 Callback params:', {
      accessToken: !!accessToken,
      idToken: !!idToken,
      error,
      errorDescription,
    });

    if (error) {
      console.error('❌ Auth0 error:', error, errorDescription);
      this.handleError(error, errorDescription || undefined);
      return;
    }

    if (accessToken && idToken) {
      console.log('✅ Auth0 tokens received, redirecting to mobile app');

      // Store tokens in localStorage
      localStorage.setItem('auth0_access_token', accessToken);
      localStorage.setItem('auth0_id_token', idToken);

      // Redirect back to mobile app
      this.redirectToMobileApp();
    } else {
      console.error('❌ No tokens received');
      this.handleError('no_tokens', 'No authentication tokens received');
    }
  }

  private redirectToMobileApp() {
    if (Capacitor.isNativePlatform()) {
      // If we're already in the mobile app, just navigate to home
      this.router.navigate(['/']);
    } else {
      // If we're in a web browser, try to redirect to the mobile app
      console.log('🔗 Attempting to redirect to mobile app');

      // Store a flag to indicate we have tokens ready
      localStorage.setItem('auth0_tokens_ready', 'true');
      localStorage.setItem('auth0_redirect_time', Date.now().toString());

      // Try multiple methods to open the mobile app
      const mobileAppUrl = 'com.kyrgz.translation://auth0/callback';

      // Method 1: Direct location change
      window.location.href = mobileAppUrl;

      // Method 2: Create a hidden iframe (more reliable on iOS)
      setTimeout(() => {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = mobileAppUrl;
        document.body.appendChild(iframe);

        // Clean up after a short delay
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);

      // Method 3: Use window.open as fallback
      setTimeout(() => {
        window.open(mobileAppUrl, '_self');
      }, 1000);

      // Final fallback: redirect to home page after a delay
      setTimeout(() => {
        this.router.navigate(['/']);
      }, 3000);
    }
  }

  private handleError(error: string, description?: string) {
    console.error('❌ Authentication error:', error, description);

    // Store error in localStorage for the mobile app to pick up
    localStorage.setItem('auth0_error', error);
    if (description) {
      localStorage.setItem('auth0_error_description', description);
    }

    // Redirect back to mobile app or home
    this.redirectToMobileApp();
  }
}
