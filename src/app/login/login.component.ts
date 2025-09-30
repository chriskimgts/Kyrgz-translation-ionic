import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

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
export class LoginComponent {
  @Output() loginSuccess = new EventEmitter<{ email: string; name: string }>();
  @Output() registerSuccess = new EventEmitter<{
    email: string;
    name: string;
  }>();

  showRegister = false;
  isLoading = false;

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

  onLogin() {
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
