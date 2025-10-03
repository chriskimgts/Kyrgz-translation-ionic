import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Output,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { MobileAuthService } from '../services/mobile-auth.service';

interface LoginData {
  email: string;
  phoneNumber: string;
  countryCode: string;
  password: string;
  rememberMe: boolean;
  loginMethod: 'email' | 'phone';
}

interface RegisterData {
  name: string;
  email: string;
  phoneNumber: string;
  countryCode: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  registrationMethod: 'email' | 'phone';
}

interface CountryCode {
  code: string;
  country: string;
  flag: string;
}

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class LoginComponent implements OnInit, OnDestroy {
  @Output() loginSuccess = new EventEmitter<{ email: string; name: string }>();
  @Output() registerSuccess = new EventEmitter<{
    email: string;
    name: string;
  }>();

  private auth0 = inject(Auth0Service);
  private mobileAuth = inject(MobileAuthService);

  showRegister = false;
  isLoading = false;
  // Use Auth0 for both web and mobile
  useAuth0 = true;
  private urlOpenListener: any;
  private auth0ListenerHandle: any;
  private pendingAuth0State: string | null = null;
  private auth0Resolve: ((result: any) => void) | null = null;
  private auth0Reject: ((error: any) => void) | null = null;

  // Check if running on mobile
  isMobile = Capacitor.isNativePlatform();

  ngOnInit() {
    // Listen for Auth0 authentication status (WEB ONLY)
    if (!Capacitor.isNativePlatform()) {
      this.auth0.isAuthenticated$.subscribe((isAuth) => {
        if (isAuth) {
          // User is authenticated, get their info
          this.auth0.user$.subscribe((auth0User) => {
            if (auth0User) {
              console.log('✅ Web Auth0 authenticated, emitting loginSuccess');
              this.isLoading = false;

              // Emit login success to show main page
              this.loginSuccess.emit({
                email: auth0User.email || '',
                name: auth0User.name || auth0User.email || 'User',
              });
            }
          });
        }
      });
    } else {
      // Set up app state listeners for better callback handling (MOBILE ONLY)
      this.mobileAuth.setupAppStateListeners();

      // Set up Auth0 deep link listener once and wait for it
      this.setupAuth0Listener()
        .then(() => {
          console.log('✅ Auth0 listener setup complete');
        })
        .catch((error) => {
          console.error('❌ Error setting up Auth0 listener:', error);
        });

      // Check for tokens from web callback when component loads (MOBILE ONLY)
      const callbackResult = this.mobileAuth.checkForWebCallbackTokens();
      if (callbackResult && callbackResult.code) {
        console.log('✅ Found tokens from web callback, completing login');
        this.mobileAuth
          .getUserInfo(callbackResult.code)
          .then((userInfo) => {
            this.loginSuccess.emit({
              email: userInfo.email || '',
              name: userInfo.name || userInfo.email || 'User',
            });
          })
          .catch((error) => {
            console.error('❌ Error getting user info from callback:', error);
          });
      }
    }
  }

  ngOnDestroy() {
    // Clean up Auth0 listener
    if (this.auth0ListenerHandle) {
      this.auth0ListenerHandle.remove();
    }
  }

  // Set up Auth0 deep link listener once
  async setupAuth0Listener() {
    if (this.auth0ListenerHandle) {
      return; // Already set up
    }

    console.log('👂 Setting up Auth0 deep link listener...');
    this.auth0ListenerHandle = await App.addListener(
      'appUrlOpen',
      async (event: URLOpenListenerEvent) => {
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
            this.isLoading = false;
            if (this.auth0Reject) {
              this.auth0Reject(new Error(error));
            }
            alert('❌ Auth0 error: ' + error);
          } else if (
            accessToken &&
            idToken &&
            returnedState === this.pendingAuth0State
          ) {
            console.log('✅ Auth0 tokens received');

            // Store tokens
            localStorage.setItem('auth0_access_token', accessToken);
            localStorage.setItem('auth0_id_token', idToken);

            // Get user info and complete login/registration
            try {
              const userInfo = await this.mobileAuth.getUserInfo(accessToken);
              console.log('✅ Mobile Auth0 user info:', userInfo);

              this.isLoading = false;

              // Resolve the Promise with user info
              if (this.auth0Resolve) {
                this.auth0Resolve({
                  email: userInfo.email || '',
                  name: userInfo.name || userInfo.email || 'User',
                });
              }
            } catch (userError) {
              console.error('❌ Error getting user info:', userError);
              this.isLoading = false;
              if (this.auth0Reject) {
                this.auth0Reject(userError);
              }
            }
          } else {
            console.error('❌ Invalid Auth0 response');
            this.isLoading = false;
            if (this.auth0Reject) {
              this.auth0Reject(new Error('Invalid authentication response'));
            }
            alert('❌ Invalid Auth0 response');
          }
        }
      }
    );
    console.log('✅ Auth0 listener set up');
  }

  // Handle Auth0 login click with proper event handling
  async handleAuth0LoginClick(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    try {
      await this.loginWithAuth0();
    } catch (error) {
      console.error('❌ Auth0 login failed:', error);
      this.isLoading = false;
      alert('Auth0 login failed: ' + (error as Error).message);
    }
  }

  // Handle Auth0 registration click with proper event handling
  async handleAuth0RegisterClick(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    try {
      await this.registerWithAuth0();
    } catch (error) {
      console.error('❌ Auth0 registration failed:', error);
      this.isLoading = false;
      alert('Auth0 registration failed: ' + (error as Error).message);
    }
  }

  loginData: LoginData = {
    email: '',
    phoneNumber: '',
    countryCode: '+1',
    password: '',
    rememberMe: false,
    loginMethod: 'email',
  };

  registerData: RegisterData = {
    name: '',
    email: '',
    phoneNumber: '',
    countryCode: '+1',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
    registrationMethod: 'email',
  };

  // Popular country codes for Central Asia and common regions
  countryCodes: CountryCode[] = [
    { code: '+1', country: 'United States', flag: '🇺🇸' },
    { code: '+7', country: 'Kazakhstan/Russia', flag: '🇰🇿' },
    { code: '+996', country: 'Kyrgyzstan', flag: '🇰🇬' },
    { code: '+998', country: 'Uzbekistan', flag: '🇺🇿' },
    { code: '+992', country: 'Tajikistan', flag: '🇹🇯' },
    { code: '+993', country: 'Turkmenistan', flag: '🇹🇲' },
    { code: '+86', country: 'China', flag: '🇨🇳' },
    { code: '+82', country: 'South Korea', flag: '🇰🇷' },
    { code: '+90', country: 'Turkey', flag: '🇹🇷' },
    { code: '+98', country: 'Iran', flag: '🇮🇷' },
    { code: '+93', country: 'Afghanistan', flag: '🇦🇫' },
    { code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
    { code: '+49', country: 'Germany', flag: '🇩🇪' },
    { code: '+33', country: 'France', flag: '🇫🇷' },
    { code: '+81', country: 'Japan', flag: '🇯🇵' },
  ];

  // Auth0 Login - wait for deep link success
  async loginWithAuth0(): Promise<void> {
    console.log('🔐 Auth0 login button clicked');
    this.isLoading = true;

    // Set a timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      if (this.isLoading) {
        console.log('⚠️ Auth0 login timeout, resetting loading state');
        this.isLoading = false;
        if (this.auth0Reject) {
          this.auth0Reject(new Error('Auth0 login timed out'));
        }
        alert('Auth0 login timed out. Please try again.');
      }
    }, 30000); // 30 second timeout

    try {
      if (Capacitor.isNativePlatform()) {
        // Mobile: Use Promise-based flow that waits for deep link success
        console.log(
          '📱 Using mobile Auth0 flow with Promise-based deep link waiting'
        );

        // Ensure listener is set up
        if (!this.auth0ListenerHandle) {
          console.log('⚠️ Auth0 listener not ready, setting up now...');
          await this.setupAuth0Listener();
        }

        // Generate random state and nonce for security
        const state = Math.random().toString(36).substring(7);
        const nonce = Math.random().toString(36).substring(7);

        // Store state for validation
        this.pendingAuth0State = state;

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

        // Return a Promise that resolves when deep link succeeds
        return new Promise((resolve, reject) => {
          this.auth0Resolve = (userInfo) => {
            clearTimeout(loadingTimeout);
            console.log('✅ Auth0 login successful, redirecting to main page');
            this.loginSuccess.emit(userInfo);
            resolve();
          };

          this.auth0Reject = (error) => {
            clearTimeout(loadingTimeout);
            console.error('❌ Auth0 login failed:', error);
            reject(error);
          };

          // Open Auth0 in browser
          Browser.open({ url: authUrl })
            .then(() => {
              console.log('✅ Auth0 browser opened, waiting for deep link...');
            })
            .catch((browserError) => {
              clearTimeout(loadingTimeout);
              this.isLoading = false;
              reject(browserError);
            });
        });
      } else {
        // Web: Use standard Auth0 Angular SDK
        console.log('🌐 Using web Auth0 flow');
        this.auth0.loginWithRedirect({
          appState: { target: '/' },
        });
        clearTimeout(loadingTimeout);
      }
    } catch (error) {
      console.error('❌ Auth0 login error:', error);
      clearTimeout(loadingTimeout);
      this.isLoading = false;
      alert('Auth0 login failed: ' + (error as Error).message);
      throw error;
    }
  }

  // Auth0 Registration - wait for deep link success
  async registerWithAuth0(): Promise<void> {
    console.log('📝 Auth0 register button clicked');
    this.isLoading = true;

    // Set a timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      if (this.isLoading) {
        console.log('⚠️ Auth0 registration timeout, resetting loading state');
        this.isLoading = false;
        if (this.auth0Reject) {
          this.auth0Reject(new Error('Auth0 registration timed out'));
        }
        alert('Auth0 registration timed out. Please try again.');
      }
    }, 30000); // 30 second timeout

    try {
      if (Capacitor.isNativePlatform()) {
        // Mobile: Use Promise-based flow that waits for deep link success
        console.log(
          '📱 Using mobile Auth0 registration flow with Promise-based deep link waiting'
        );

        // Ensure listener is set up
        if (!this.auth0ListenerHandle) {
          console.log('⚠️ Auth0 listener not ready, setting up now...');
          await this.setupAuth0Listener();
        }

        // Generate random state and nonce for security
        const state = Math.random().toString(36).substring(7);
        const nonce = Math.random().toString(36).substring(7);

        // Store state for validation
        this.pendingAuth0State = state;

        // Auth0 URL with proper deep link handling (Auth0 will show signup option)
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

        console.log('🔗 Auth0 Registration URL:', authUrl);

        // Return a Promise that resolves when deep link succeeds
        return new Promise((resolve, reject) => {
          this.auth0Resolve = (userInfo) => {
            clearTimeout(loadingTimeout);
            console.log(
              '✅ Auth0 registration successful, redirecting to main page'
            );
            this.loginSuccess.emit(userInfo); // Use loginSuccess for both login and registration
            resolve();
          };

          this.auth0Reject = (error) => {
            clearTimeout(loadingTimeout);
            console.error('❌ Auth0 registration failed:', error);
            reject(error);
          };

          // Open Auth0 in browser
          Browser.open({ url: authUrl })
            .then(() => {
              console.log(
                '✅ Auth0 registration browser opened, waiting for deep link...'
              );
            })
            .catch((browserError) => {
              clearTimeout(loadingTimeout);
              this.isLoading = false;
              reject(browserError);
            });
        });
      } else {
        // Web: Use standard Auth0 with signup hint
        this.auth0.loginWithRedirect({
          appState: { target: '/' },
          authorizationParams: {
            screen_hint: 'signup',
          },
        });
        clearTimeout(loadingTimeout);
      }
    } catch (error) {
      console.error('❌ Auth0 register error:', error);
      clearTimeout(loadingTimeout);
      this.isLoading = false;
      alert('Auth0 registration failed: ' + (error as Error).message);
      throw error;
    }
  }

  onLogin() {
    // Prevent form submission when Auth0 is being used
    if (this.useAuth0) {
      return;
    }

    if (this.isLoading) return;

    // Validate based on login method
    if (this.loginData.loginMethod === 'email') {
      if (!this.loginData.email) {
        alert('Please enter your email address');
        return;
      }
    } else {
      if (!this.loginData.phoneNumber) {
        alert('Please enter your phone number');
        return;
      }
    }

    if (!this.loginData.password) {
      alert('Please enter your password');
      return;
    }

    this.isLoading = true;

    // Simulate login API call
    setTimeout(() => {
      const identifier =
        this.loginData.loginMethod === 'email'
          ? this.loginData.email
          : `${this.loginData.countryCode}${this.loginData.phoneNumber}`;

      console.log('Login successful:', identifier);
      this.loginSuccess.emit({
        email: identifier, // Use email field for both email and phone
        name:
          this.loginData.loginMethod === 'email'
            ? this.loginData.email.split('@')[0]
            : this.loginData.phoneNumber, // Use phone number as name for phone login
      });
      this.isLoading = false;
    }, 1500);
  }

  onLoginMethodChange() {
    // Reset the non-selected field when switching methods
    if (this.loginData.loginMethod === 'email') {
      this.loginData.phoneNumber = '';
    } else {
      this.loginData.email = '';
    }
  }

  onRegister() {
    if (this.useAuth0) {
      this.registerWithAuth0();
      return;
    }

    if (this.isLoading) return;

    // Basic validation
    if (this.registerData.password !== this.registerData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (!this.registerData.acceptTerms) {
      alert('Please accept the terms and conditions');
      return;
    }

    // Validate based on registration method
    if (this.registerData.registrationMethod === 'email') {
      if (!this.registerData.email) {
        alert('Please enter your email address');
        return;
      }
    } else {
      if (!this.registerData.phoneNumber) {
        alert('Please enter your phone number');
        return;
      }
    }

    this.isLoading = true;

    // Simulate register API call
    setTimeout(() => {
      const identifier =
        this.registerData.registrationMethod === 'email'
          ? this.registerData.email
          : `${this.registerData.countryCode}${this.registerData.phoneNumber}`;

      console.log('Registration successful:', identifier);
      this.registerSuccess.emit({
        email: identifier, // Use email field for both email and phone
        name: this.registerData.name,
      });
      this.isLoading = false;
    }, 1500);
  }

  onRegistrationMethodChange() {
    // Reset the non-selected field when switching methods
    if (this.registerData.registrationMethod === 'email') {
      this.registerData.phoneNumber = '';
    } else {
      this.registerData.email = '';
    }
  }
}
