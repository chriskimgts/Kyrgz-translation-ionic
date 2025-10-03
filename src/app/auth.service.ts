import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuthService as Auth0Service } from '@auth0/auth0-angular';

export interface User {
  email: string;
  name: string;
  userId?: string; // Unique user ID for conversation history
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private auth0 = inject(Auth0Service);
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  // Callback when user changes (for conversation history)
  private userChangeCallbacks: Array<(userId: string) => void> = [];

  constructor() {
    // Check if user is already logged in (from localStorage)
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      this.currentUserSubject.next(JSON.parse(savedUser));
    }

    // Listen to Auth0 authentication state
    this.auth0.isAuthenticated$.subscribe((isAuthenticated) => {
      console.log('🔐 Auth0 authentication state:', isAuthenticated);
      if (isAuthenticated) {
        this.auth0.user$.subscribe((auth0User) => {
          if (auth0User) {
            console.log('🔐 Auth0 user logged in:', auth0User);
            const userId = auth0User.sub || auth0User.email || 'anonymous'; // Use Auth0 sub (user ID) as unique identifier
            const user: User = {
              email: auth0User.email || '',
              name: auth0User.name || auth0User.email || 'User',
              userId: userId,
            };
            this.currentUserSubject.next(user);
            localStorage.setItem('currentUser', JSON.stringify(user));
            console.log('✅ User set in AuthService:', user);

            // Notify conversation history service
            this.notifyUserChange(userId);
          }
        });
      }
    });

    // Handle Auth0 errors
    this.auth0.error$.subscribe((error) => {
      if (error) {
        console.error('❌ Auth0 error:', error);
      }
    });
  }

  login(email: string, name: string): void {
    const userId = email; // Use email as userId for traditional login
    const user: User = { email, name, userId };
    this.currentUserSubject.next(user);
    localStorage.setItem('currentUser', JSON.stringify(user));

    // Notify conversation history service
    this.notifyUserChange(userId);
  }

  logout(): void {
    this.currentUserSubject.next(null);
    localStorage.removeItem('currentUser');

    // Reset to anonymous user for conversation history
    this.notifyUserChange('anonymous');

    // Also logout from Auth0 if authenticated
    this.auth0.isAuthenticated$.subscribe((isAuth) => {
      if (isAuth) {
        this.auth0.logout({
          logoutParams: { returnTo: window.location.origin },
        });
      }
    });
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  // Register a callback for when user changes (for conversation history)
  onUserChange(callback: (userId: string) => void): void {
    this.userChangeCallbacks.push(callback);
  }

  private notifyUserChange(userId: string): void {
    this.userChangeCallbacks.forEach((callback) => callback(userId));
  }
}
