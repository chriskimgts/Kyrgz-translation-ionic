import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";

export interface User {
  email: string;
  name: string;
}

@Injectable({
  providedIn: "root",
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    // Check if user is already logged in (from localStorage)
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      this.currentUserSubject.next(JSON.parse(savedUser));
    }
  }

  login(email: string, name: string): void {
    const user: User = { email, name };
    this.currentUserSubject.next(user);
    localStorage.setItem("currentUser", JSON.stringify(user));
  }

  logout(): void {
    this.currentUserSubject.next(null);
    localStorage.removeItem("currentUser");
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }
}
