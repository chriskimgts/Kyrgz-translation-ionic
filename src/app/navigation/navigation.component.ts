import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  OnDestroy,
  ChangeDetectorRef,
  NgZone,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  TranslationService,
  TranslationKeys,
} from '../services/translation.service';
import { Subscription } from 'rxjs';

export interface Voice {
  id: string;
  name: string;
  icon: string;
}

export interface User {
  email: string;
  name: string;
}

export interface LanguageOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-navigation',
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule],
})
export class NavigationComponent implements OnInit, OnDestroy {
  @Input() selectedVoice: string = 'alloy';
  @Input() availableVoices: Voice[] = [];
  @Input() currentUser: User | null = null;
  @Input() isLoggedIn: boolean = false;
  @Input() selectedUserLanguage: 'en' | 'ko' | 'zh' | 'ru' = 'en';
  @Input() selectedPartnerLanguage: 'ky' | 'kk' | 'tg' | 'tk' | 'uz' = 'ky';
  @Input() speakingSpeed: number = 1.0;
  @Output() voiceSelected = new EventEmitter<string>();
  @Output() logout = new EventEmitter<void>();
  @Output() showHistory = new EventEmitter<void>();
  @Output() languageChanged = new EventEmitter<{
    userLanguage: string;
    partnerLanguage: string;
  }>();
  @Output() speedChanged = new EventEmitter<number>();

  isMobileMenuOpen: boolean = false;
  isLanguageMenuOpen = false;

  // Translation properties
  translations: TranslationKeys = {} as TranslationKeys;
  private translationSubscription?: Subscription;

  constructor(
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  // Language options
  userLanguages: LanguageOption[] = [
    { value: 'en', label: 'English' },
    { value: 'ko', label: 'Korean (한국어)' },
    { value: 'zh', label: 'Chinese (中文)' },
    { value: 'ru', label: 'Russian (Русский)' },
  ];

  partnerLanguages: LanguageOption[] = [
    { value: 'ky', label: 'Kyrgyz (Кыргызча)' },
    { value: 'kk', label: 'Kazakh (Қазақша)' },
    { value: 'tg', label: 'Tajik (Тоҷикӣ)' },
    { value: 'tk', label: 'Turkmen (Türkmençe)' },
    { value: 'uz', label: "Uzbek (O'zbekcha)" },
  ];

  // Version management
  private readonly CURRENT_VERSION = 1;
  currentVersion: number = 1;
  isNewVersion: boolean = false;

  selectVoice(voiceId: string) {
    this.selectedVoice = voiceId;
    this.voiceSelected.emit(voiceId);
  }

  toggleMobileMenu() {
    console.log('Before toggle - isMobileMenuOpen:', this.isMobileMenuOpen);
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
    console.log('After toggle - isMobileMenuOpen:', this.isMobileMenuOpen);

    // Use setTimeout to ensure change detection runs after the current cycle
    setTimeout(() => {
      this.cdr.detectChanges();
      console.log('Change detection triggered');
    }, 0);
  }

  closeMobileMenu() {
    this.isMobileMenuOpen = false;
    this.cdr.detectChanges();
  }

  // Debug method to check current state
  getMenuState() {
    console.log('Current menu state:', this.isMobileMenuOpen);
    return this.isMobileMenuOpen;
  }

  onLogout() {
    this.logout.emit();
  }

  onShowHistory() {
    console.log('Navigation onShowHistory called, emitting showHistory event');
    this.showHistory.emit();
  }

  toggleLanguageMenu() {
    this.isLanguageMenuOpen = !this.isLanguageMenuOpen;
  }

  closeLanguageMenu() {
    this.isLanguageMenuOpen = false;
  }

  onUserLanguageChange() {
    // Update translation service with new language
    this.translationService.setLanguage(this.selectedUserLanguage);

    this.languageChanged.emit({
      userLanguage: this.selectedUserLanguage,
      partnerLanguage: this.selectedPartnerLanguage,
    });
  }

  onPartnerLanguageChange() {
    this.languageChanged.emit({
      userLanguage: this.selectedUserLanguage,
      partnerLanguage: this.selectedPartnerLanguage,
    });
  }

  onSpeedChange() {
    this.speedChanged.emit(this.speakingSpeed);
  }

  getUserLanguageName(lang: string): string {
    const option = this.userLanguages.find((l) => l.value === lang);
    return option ? option.label : lang;
  }

  getPartnerLanguageName(lang: string): string {
    const option = this.partnerLanguages.find((l) => l.value === lang);
    return option ? option.label : lang;
  }

  ngOnInit() {
    this.checkVersion();
    this.loadTranslations();
    this.setupTranslationSubscription();
  }

  ngOnDestroy() {
    if (this.translationSubscription) {
      this.translationSubscription.unsubscribe();
    }
  }

  private loadTranslations() {
    this.translations = this.translationService.getAllTranslations();
  }

  private setupTranslationSubscription() {
    this.translationSubscription =
      this.translationService.currentLanguage$.subscribe(() => {
        this.loadTranslations();
      });
  }

  private checkVersion() {
    try {
      const storedVersion = localStorage.getItem('appVersion');
      const storedVersionNumber = storedVersion
        ? parseInt(storedVersion, 10)
        : 0;

      console.log(
        `🔍 Version check: stored=${storedVersionNumber}, current=${this.CURRENT_VERSION}`
      );

      if (storedVersionNumber < this.CURRENT_VERSION) {
        // New version detected
        this.isNewVersion = true;
        console.log(
          `🆕 New version detected! Upgrading from v${storedVersionNumber} to v${this.CURRENT_VERSION}`
        );

        // Update stored version
        localStorage.setItem('appVersion', this.CURRENT_VERSION.toString());
        this.currentVersion = this.CURRENT_VERSION;

        // Show version upgrade notification
        this.showVersionUpgradeNotification(
          storedVersionNumber,
          this.CURRENT_VERSION
        );
      } else if (storedVersionNumber === this.CURRENT_VERSION) {
        // Same version
        this.currentVersion = this.CURRENT_VERSION;
        this.isNewVersion = false;
        console.log(`✅ App version: v${this.currentVersion} (up to date)`);
      } else {
        // Stored version is newer (shouldn't happen in normal cases)
        this.currentVersion = storedVersionNumber;
        this.isNewVersion = false;
        console.log(
          `⚠️ Stored version (v${storedVersionNumber}) is newer than current (v${this.CURRENT_VERSION})`
        );
      }
    } catch (error) {
      console.error('Error checking version:', error);
      // Fallback: set current version
      localStorage.setItem('appVersion', this.CURRENT_VERSION.toString());
      this.currentVersion = this.CURRENT_VERSION;
      this.isNewVersion = false;
    }
  }

  private showVersionUpgradeNotification(
    oldVersion: number,
    newVersion: number
  ) {
    // Show a notification about the version upgrade
    const message = `App updated to version ${newVersion}!${
      oldVersion > 0 ? ` (was v${oldVersion})` : ''
    }`;

    // You can customize this notification method
    // For now, we'll use console and could add a toast notification later
    console.log(`🎉 ${message}`);

    // Optional: Show browser notification if supported
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('App Updated!', {
        body: message,
        icon: '/favicon.ico',
      });
    }
  }

  getVersionDisplay(): string {
    return `v${this.currentVersion}`;
  }

  getVersionStatus(): string {
    return this.isNewVersion ? 'New!' : 'Current';
  }

  /**
   * Manually update the app version in localStorage
   * Useful for testing or forcing a version update
   */
  updateStoredVersion(newVersion: number): void {
    try {
      const oldVersion = localStorage.getItem('appVersion');
      localStorage.setItem('appVersion', newVersion.toString());
      this.currentVersion = newVersion;
      this.isNewVersion = newVersion > this.CURRENT_VERSION;

      console.log(
        `🔄 Manually updated version from ${oldVersion} to ${newVersion}`
      );
    } catch (error) {
      console.error('Error updating stored version:', error);
    }
  }

  /**
   * Clear the stored version (useful for testing)
   */
  clearStoredVersion(): void {
    try {
      localStorage.removeItem('appVersion');
      console.log('🗑️ Cleared stored version from localStorage');

      // Re-check version to trigger upgrade flow
      this.checkVersion();
    } catch (error) {
      console.error('Error clearing stored version:', error);
    }
  }

  /**
   * Get the stored version from localStorage
   */
  getStoredVersion(): number {
    try {
      const storedVersion = localStorage.getItem('appVersion');
      return storedVersion ? parseInt(storedVersion, 10) : 0;
    } catch (error) {
      console.error('Error getting stored version:', error);
      return 0;
    }
  }
}
