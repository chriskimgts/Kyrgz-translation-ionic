import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule, Platform } from '@ionic/angular';
import { AuthService, User } from './auth.service';
import { ConversationHistoryModalComponent } from './conversation-history-modal/conversation-history-modal.component';
import {
  ConversationHistoryEntry,
  ConversationHistoryService,
} from './conversation-history.service';
import { LoginComponent } from './login/login.component';
import { NavigationComponent } from './navigation/navigation.component';
import { TranslatorService } from './services/translator.service';
import {
  TranslationService,
  TranslationKeys,
} from './services/translation.service';
import { Subscription } from 'rxjs';

interface ConversationEntry {
  id: number;
  original: string;
  translated: string;
  timestamp: Date;
  audioUrl?: string;
  audioData?: string;
  userLanguage: 'en' | 'ko' | 'zh' | 'ky' | 'ru' | 'kk' | 'tg' | 'tk' | 'uz';
  partnerLanguage: 'en' | 'ko' | 'zh' | 'ky' | 'ru' | 'kk' | 'tg' | 'tk' | 'uz';
  confidence?: number;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
    IonicModule,
    LoginComponent,
    NavigationComponent,
    ConversationHistoryModalComponent,
  ],
})
export class AppComponent implements OnDestroy {
  // Authentication
  currentUser: User | null = null;
  isLoggedIn = false;

  // Translation
  translations: TranslationKeys = {} as TranslationKeys;
  private translationSubscription?: Subscription;

  // Language selection
  selectedUserLanguage: 'en' | 'ko' | 'zh' | 'ru' = 'en';
  selectedPartnerLanguage: 'ky' | 'kk' | 'tg' | 'tk' | 'uz' = 'ky';

  // Voice and speed settings
  selectedVoice = 'alloy';
  speakingSpeed = 1.0;
  availableVoices = [
    { id: 'alloy', name: 'Alloy (Neutral)', icon: '😐' },
    { id: 'echo', name: 'Echo (Male)', icon: '👨' },
    { id: 'fable', name: 'Fable (Theatrical)', icon: '🎭' },
    { id: 'onyx', name: 'Onyx (Deep)', icon: '' },
    { id: 'nova', name: 'Nova (Female)', icon: '♀️' },
    { id: 'shimmer', name: 'Shimmer (Soft)', icon: '' },
  ];

  // Conversation management
  conversationId = 1;

  // Audio processing
  private mediaRecorder?: MediaRecorder;
  private stream?: MediaStream;
  private chunks: Blob[] = [];
  private sentenceBuffer = '';
  private silenceTimeout?: any;
  private periodicRefreshInterval?: any;
  private idleTimeout?: any;

  // Constants
  private readonly USER_LANGUAGE_KEY = 'selectedUserLanguage';
  private readonly PARTNER_LANGUAGE_KEY = 'selectedPartnerLanguage';
  private readonly SPEAKING_SPEED_KEY = 'speakingSpeed';
  private readonly VOICE_SELECTION_KEY = 'selectedVoice';

  // Spinners
  isProcessingEnd = false;
  isProcessingPostTranslation = false;
  isProcessingIntermediate = false;
  isProcessingFinalizing = false;
  isProcessingTranslation = false; // General translation spinner
  currentLane: 'user' | 'partner' | null = null;

  // Text input
  userTextInput: string = '';
  partnerTextInput: string = '';

  // Conversation History
  showHistoryModal = false;

  // EN → KY lane
  enConversation: ConversationEntry[] = [];
  currentEnText = '';
  currentKyText = '';
  currentEnConfidence = 0;

  // KY → EN lane
  kyConversation: ConversationEntry[] = [];
  currentKyInText = '';
  currentEnOutText = '';
  currentKyConfidence = 0;

  // Recording state
  isRecording = false;
  isAutoRestarting = false;
  manuallyStopped = false;
  isPlayingAudio = false;

  // Mobile detection
  isMobile: boolean = false;

  // Math object for template
  Math = Math;

  // Getter for recording state (matches original webapp)
  get recording() {
    return this.isRecording;
  }

  // Language options for template
  userLanguages = [
    { value: 'en', label: 'English' },
    { value: 'ko', label: 'Korean (한국어)' },
    { value: 'zh', label: 'Chinese (中文)' },
    { value: 'ru', label: 'Russian (Русский)' },
  ];

  partnerLanguages = [
    { value: 'ky', label: 'Kyrgyz (Кыргызча)' },
    { value: 'kk', label: 'Kazakh (Қазақша)' },
    { value: 'tg', label: 'Tajik (Тоҷикӣ)' },
    { value: 'tk', label: 'Turkmen (Türkmençe)' },
    { value: 'uz', label: "Uzbek (O'zbekcha)" },
  ];

  constructor(
    private svc: TranslatorService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private conversationHistoryService: ConversationHistoryService,
    private platform: Platform,
    private translationService: TranslationService
  ) {
    this.isMobile = this.platform.is('capacitor');
    this.initializeApp();
    this.loadLanguageSelections();
    this.setupAuthListener();
    this.setupTranslation();
  }

  async initializeApp() {
    await this.platform.ready();

    // Request microphone permission on mobile
    if (this.platform.is('capacitor')) {
      try {
        // Use standard Web API for microphone access
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (error) {
        console.warn('Microphone permission not available:', error);
      }
    }
  }

  private setupAuthListener() {
    this.authService.currentUser$.subscribe((user: User | null) => {
      this.currentUser = user;
      this.isLoggedIn = !!user;
    });
  }

  private loadLanguageSelections() {
    try {
      const userLang = localStorage.getItem(this.USER_LANGUAGE_KEY);
      const partnerLang = localStorage.getItem(this.PARTNER_LANGUAGE_KEY);
      const speed = localStorage.getItem(this.SPEAKING_SPEED_KEY);
      const voice = localStorage.getItem(this.VOICE_SELECTION_KEY);

      if (userLang && ['en', 'ko', 'zh', 'ru'].includes(userLang)) {
        this.selectedUserLanguage = userLang as 'en' | 'ko' | 'zh' | 'ru';
      }
      if (partnerLang && ['ky', 'kk', 'tg', 'tk', 'uz'].includes(partnerLang)) {
        this.selectedPartnerLanguage = partnerLang as
          | 'ky'
          | 'kk'
          | 'tg'
          | 'tk'
          | 'uz';
      }
      if (speed) {
        this.speakingSpeed = parseFloat(speed);
      }
      if (voice) {
        this.selectedVoice = voice;
      }
    } catch (error) {
      console.error(
        'Error loading language selections from local storage:',
        error
      );
    }
  }

  onLanguageChanged(event: { userLanguage: string; partnerLanguage: string }) {
    // Update the language selections from the navigation component
    this.selectedUserLanguage = event.userLanguage as 'en' | 'ko' | 'zh' | 'ru';
    this.selectedPartnerLanguage = event.partnerLanguage as
      | 'ky'
      | 'kk'
      | 'tg'
      | 'tk'
      | 'uz';
    this.saveLanguageSelections();

    // Update translation service with new user language
    this.translationService.setLanguage(this.selectedUserLanguage);

    console.log(
      'Language changed - User:',
      this.selectedUserLanguage,
      'Partner:',
      this.selectedPartnerLanguage
    );
  }

  onUserLanguageChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    this.selectedUserLanguage = selectElement.value as
      | 'en'
      | 'ko'
      | 'zh'
      | 'ru';
    this.saveLanguageSelections();
  }

  onPartnerLanguageChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    this.selectedPartnerLanguage = selectElement.value as
      | 'ky'
      | 'kk'
      | 'tg'
      | 'tk'
      | 'uz';
    this.saveLanguageSelections();
  }

  onSpeedChange(newSpeed: number) {
    this.speakingSpeed = newSpeed;
    this.saveLanguageSelections();
  }

  selectVoice(voiceId: string) {
    this.selectedVoice = voiceId;
    this.saveLanguageSelections();
  }

  private saveLanguageSelections() {
    try {
      localStorage.setItem(this.USER_LANGUAGE_KEY, this.selectedUserLanguage);
      localStorage.setItem(
        this.PARTNER_LANGUAGE_KEY,
        this.selectedPartnerLanguage
      );
      localStorage.setItem(
        this.SPEAKING_SPEED_KEY,
        this.speakingSpeed.toString()
      );
      localStorage.setItem(this.VOICE_SELECTION_KEY, this.selectedVoice);
    } catch (error) {
      console.error(
        'Error saving language selections to local storage:',
        error
      );
    }
  }

  // Authentication methods
  onLoginSuccess(user: { email: string; name: string }) {
    this.authService.login(user.email, user.name);
  }

  onRegisterSuccess(user: { email: string; name: string }) {
    this.authService.login(user.email, user.name);
  }

  onLogout() {
    console.log('🚪 Logging out user...');

    // Clear authentication state
    this.authService.logout();

    // Reset user state
    this.currentUser = null;
    this.isLoggedIn = false;

    // Clear conversation history from service
    this.conversationHistoryService.clearAllHistory();

    // Clear local conversation arrays
    this.enConversation = [];
    this.kyConversation = [];

    // Clear current text inputs and translations
    this.userTextInput = '';
    this.partnerTextInput = '';
    this.currentEnText = '';
    this.currentKyText = '';
    this.currentKyInText = '';
    this.currentEnOutText = '';
    this.currentEnConfidence = 0;
    this.currentKyConfidence = 0;

    // Stop any ongoing recording
    if (this.isRecording) {
      this.stopRecording();
    }

    // Clear any processing states
    this.isProcessingTranslation = false;
    this.currentLane = null;

    // Clear audio buffers
    this.cleanupBuffers();

    // Reset language selections to defaults
    this.selectedUserLanguage = 'en';
    this.selectedPartnerLanguage = 'ky';
    this.saveLanguageSelections();

    // Close any open modals
    this.showHistoryModal = false;

    console.log('✅ User logged out successfully');

    // Trigger change detection to update UI
    this.cdr.detectChanges();
  }

  // Conversation history modal
  onShowHistory() {
    console.log(
      'AppComponent onShowHistory called, setting showHistoryModal to true'
    );
    this.showHistoryModal = true;
    this.cdr.detectChanges(); // Force change detection
    console.log('showHistoryModal is now:', this.showHistoryModal);

    // Additional debugging
    setTimeout(() => {
      console.log('After timeout - showHistoryModal:', this.showHistoryModal);
      const modalElement = document.querySelector(
        'app-conversation-history-modal'
      ) as HTMLElement;
      console.log('Modal element in DOM:', modalElement);
      if (modalElement) {
        console.log(
          'Modal element visible:',
          modalElement.offsetParent !== null
        );
        console.log(
          'Modal element display:',
          window.getComputedStyle(modalElement).display
        );
      } else {
        console.log('❌ Modal element not found in DOM!');
        // Check if there are any elements with modal-related classes
        const modalDivs = document.querySelectorAll(
          '.fixed.inset-0, .bg-black.bg-opacity-50'
        );
        console.log('Modal-related divs found:', modalDivs.length);
        for (let i = 0; i < modalDivs.length; i++) {
          console.log(`Modal div ${i}:`, modalDivs[i]);
        }
      }
    }, 100);
  }

  onCloseHistory() {
    console.log(
      'AppComponent onCloseHistory() called, setting showHistoryModal to false'
    );
    this.showHistoryModal = false;
    console.log('showHistoryModal is now:', this.showHistoryModal);
  }

  // Button click handler with promise support
  async onStartRecording(lane: 'user' | 'partner') {
    try {
      console.log(
        '🔍 BUTTON CLICKED - onStartRecording called for lane:',
        lane
      );
      console.log(`Starting recording for ${lane}...`);
      await this.startRecording(lane);
      console.log(`Recording started successfully for ${lane}`);
    } catch (error) {
      console.error(`Failed to start recording for ${lane}:`, error);
      // The error is already handled in startRecording method
    }
  }

  // Spinner management
  showSpinner(
    spinnerType: 'end' | 'postTranslation' | 'intermediate' | 'finalizing',
    lane: 'user' | 'partner'
  ) {
    this.zone.run(() => {
      this.currentLane = lane;
      this.isProcessingTranslation = true; // General spinner for any translation activity
      switch (spinnerType) {
        case 'end':
          this.isProcessingEnd = true;
          break;
        case 'postTranslation':
          this.isProcessingPostTranslation = true;
          break;
        case 'intermediate':
          this.isProcessingIntermediate = true;
          break;
        case 'finalizing':
          this.isProcessingFinalizing = true;
          break;
      }
      this.cdr.detectChanges();
    });
  }

  hideSpinner(
    spinnerType: 'end' | 'postTranslation' | 'intermediate' | 'finalizing'
  ) {
    this.zone.run(() => {
      switch (spinnerType) {
        case 'end':
          this.isProcessingEnd = false;
          break;
        case 'postTranslation':
          this.isProcessingPostTranslation = false;
          break;
        case 'intermediate':
          this.isProcessingIntermediate = false;
          break;
        case 'finalizing':
          this.isProcessingFinalizing = false;
          break;
      }
      // Only hide general translation spinner if all specific spinners are off
      if (
        !this.isProcessingEnd &&
        !this.isProcessingPostTranslation &&
        !this.isProcessingIntermediate &&
        !this.isProcessingFinalizing
      ) {
        this.isProcessingTranslation = false;
        this.currentLane = null;
      }
      this.cdr.detectChanges();
    });
  }

  hideAllSpinners() {
    this.zone.run(() => {
      this.isProcessingEnd = false;
      this.isProcessingPostTranslation = false;
      this.isProcessingIntermediate = false;
      this.isProcessingFinalizing = false;
      this.isProcessingTranslation = false;
      this.currentLane = null;
      this.cdr.detectChanges();
    });
  }

  async withSpinner<T>(fn: () => Promise<T>): Promise<T> {
    this.showSpinner('postTranslation', this.currentLane || 'user'); // Default to user if not set
    const timeoutDuration = this.isMobile ? 20000 : 30000; // 20s for mobile, 30s for desktop

    const timeoutPromise = new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error('Operation timed out')),
        timeoutDuration
      )
    );

    try {
      const result = await Promise.race([fn(), timeoutPromise]);
      this.hideSpinner('postTranslation');
      return result;
    } catch (error: any) {
      this.hideAllSpinners();
      console.error('Operation failed or timed out:', error);
      alert(
        `System issue: ${
          error.message || 'An unknown error occurred'
        }. Please try again.`
      );
      throw error;
    }
  }

  // Recording functionality
  async startRecording(lane: 'user' | 'partner'): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('🎤 Starting recording for lane:', lane);
        console.log('🔍 BUTTON CLICKED - Start recording method called');
        this.hideAllSpinners(); // Ensure all spinners are hidden before starting

        this.currentLane = lane;
        this.sentenceBuffer = '';
        this.chunks = [];
        this.currentEnText = '';
        this.currentKyText = '';
        this.currentKyInText = '';
        this.currentEnOutText = '';
        this.currentEnConfidence = 0;
        this.currentKyConfidence = 0;

        // Update button state immediately
        this.isRecording = true;
        this.cdr.detectChanges();

        console.log('🎤 Requesting microphone access...');
        try {
          // iOS-specific audio constraints
          const audioConstraints = this.getAudioConstraints();
          this.stream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints,
          });
          console.log('✅ Microphone access granted, stream:', this.stream);
        } catch (micError: any) {
          console.error('❌ Microphone access denied or failed:', micError);
          this.isRecording = false;
          this.cdr.detectChanges();

          if (micError.name === 'NotAllowedError') {
            alert(
              'Microphone access denied. Please allow microphone access in your browser settings and try again.'
            );
          } else if (micError.name === 'NotFoundError') {
            alert(
              'No microphone found. Please connect a microphone and try again.'
            );
          } else if (micError.name === 'NotReadableError') {
            alert(
              'Microphone is already in use by another application. Please close other apps and try again.'
            );
          } else {
            alert(
              `Microphone error: ${
                micError.message || 'Unknown error'
              }. Please check your microphone settings and try again.`
            );
          }
          reject(micError);
          return;
        }

        // Use iOS-compatible MediaRecorder options
        const mimeType = this.getAudioMimeType();
        const options = { mimeType };

        try {
          this.mediaRecorder = new MediaRecorder(this.stream, options);
          console.log(
            '🎙️ MediaRecorder created with options:',
            options,
            this.mediaRecorder
          );
        } catch (recorderError) {
          console.warn(
            '⚠️ Failed to create MediaRecorder with options, trying without options:',
            recorderError
          );
          // Fallback: try without options (uses default format)
          try {
            this.mediaRecorder = new MediaRecorder(this.stream);
            console.log('🎙️ MediaRecorder created without options (fallback)');
          } catch (fallbackError) {
            console.error(
              '❌ Failed to create MediaRecorder even without options:',
              fallbackError
            );
            throw new Error('MediaRecorder not supported on this device');
          }
        }

        this.mediaRecorder.ondataavailable = (event) => {
          console.log('📊 Audio data available, size:', event.data.size);
          this.chunks.push(event.data);
        };

        this.mediaRecorder.onstop = async () => {
          console.log('⏹️ Recording stopped, processing audio...');

          // Use iOS-compatible audio format
          const audioType = this.getAudioMimeType();
          const audioBlob = new Blob(this.chunks, { type: audioType });
          console.log(
            '🎵 Audio blob created, size:',
            audioBlob.size,
            'type:',
            audioBlob.type
          );
          const audioUrl = URL.createObjectURL(audioBlob);

          // Process the recorded audio
          await this.processAudio(audioBlob, audioUrl, lane);
        };

        console.log('🚀 Starting MediaRecorder...');
        this.mediaRecorder.start(1000); // Start recording, collect data every 1 second
        this.isRecording = true;
        this.startPeriodicRefresh();
        this.startIdleTimeout();
        console.log(
          '✅ Recording started for lane:',
          lane,
          'isRecording:',
          this.isRecording,
          'currentLane:',
          this.currentLane
        );
        this.cdr.detectChanges();

        // Resolve the promise immediately after recording starts
        resolve();
      } catch (err) {
        console.error('❌ Error starting recording:', err);
        this.isRecording = false;
        this.cdr.detectChanges();
        alert(
          'Microphone access denied. Please allow microphone access to use this feature.'
        );
        reject(err);
      }
    });
  }

  stopRecording() {
    console.log(
      'Stop recording called, isRecording:',
      this.isRecording,
      'currentLane:',
      this.currentLane
    );
    if (!this.isRecording) return;

    // ALWAYS clear buffers when end button is clicked, regardless of state
    console.log(
      '🛑 End button clicked - clearing all buffers and resetting state'
    );

    // Stop recording state immediately
    this.isRecording = false;
    this.manuallyStopped = true;
    this.isAutoRestarting = false;
    this.isProcessingTranslation = false;

    // Stop all timers and intervals
    this.stopPeriodicRefresh();
    this.stopIdleTimeout();

    // Stop the media recorder
    if (this.mediaRecorder) {
      try {
        this.mediaRecorder.stop();
      } catch (err) {
        console.warn('Error stopping media recorder:', err);
      }
      this.mediaRecorder = undefined;
    }

    // Clear timeouts
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = undefined;
    }

    // Stop all tracks in the stream
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
      this.stream = undefined;
    }

    // Check if there's any speech content before processing
    const hasSpeechContent = this.sentenceBuffer.trim().length > 0;
    const hasAudioChunks = this.chunks.length > 0;

    if (!hasSpeechContent && !hasAudioChunks) {
      // No speech detected - show alert and clean up
      console.log('No speech detected when stopping recording');
      this.hideAllSpinners();
      this.cleanupBuffers(); // Clean up buffers when no speech detected
      alert('No speech detected. Please speak before clicking End.');
      this.cdr.detectChanges();
      return; // Exit early - no processing needed
    }

    // If there is speech content, process it but ensure cleanup happens regardless
    console.log('Speech content detected, processing audio...');
    this.cdr.detectChanges();
  }

  private startPeriodicRefresh() {
    this.stopPeriodicRefresh();
    this.periodicRefreshInterval = setInterval(() => {
      this.processCompleteSentence();
    }, 5000); // Process buffer every 5 seconds
  }

  private stopPeriodicRefresh() {
    if (this.periodicRefreshInterval) {
      clearInterval(this.periodicRefreshInterval);
      this.periodicRefreshInterval = undefined;
    }
  }

  private startIdleTimeout() {
    this.stopIdleTimeout();
    const idleDuration = this.isMobile ? 10000 : 15000; // 10s for mobile, 15s for desktop
    this.idleTimeout = setTimeout(() => {
      console.log('Idle timeout reached. Auto-stopping recording.');
      this.stopRecording();
    }, idleDuration);
  }

  private stopIdleTimeout() {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = undefined;
    }
  }

  private autoResetDueToSystemIssue() {
    console.warn('System issue detected: Auto-resetting application state.');
    this.hideAllSpinners();
    alert(
      'System issue detected. The application has been reset. Please try again.'
    );
    this.resetApplicationState();
  }

  private resetApplicationState() {
    this.isRecording = false;
    this.isAutoRestarting = false;
    this.manuallyStopped = true;
    this.isProcessingTranslation = false;
    this.currentLane = null;
    this.sentenceBuffer = '';
    this.chunks = [];
    this.currentEnText = '';
    this.currentKyText = '';
    this.currentKyInText = '';
    this.currentEnOutText = '';
    this.currentEnConfidence = 0;
    this.currentKyConfidence = 0;
    this.stopPeriodicRefresh();
    this.stopIdleTimeout();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = undefined;
    }
    this.cdr.detectChanges();
  }

  private getAudioMimeType(): string {
    // Check for iOS Safari compatibility
    if (this.platform.is('ios') || this.isIOSSafari()) {
      // iOS Safari supports MP4 and WAV
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        console.log('📱 Using audio/mp4 for iOS compatibility');
        return 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        console.log('📱 Using audio/wav for iOS compatibility');
        return 'audio/wav';
      }
    }

    // Default to webm for other platforms
    if (MediaRecorder.isTypeSupported('audio/webm')) {
      console.log('🌐 Using audio/webm for other platforms');
      return 'audio/webm';
    }

    // Fallback
    console.log('⚠️ Using fallback audio format');
    return 'audio/webm';
  }

  private isIOSSafari(): boolean {
    const ua = navigator.userAgent;
    return (
      /iPad|iPhone|iPod/.test(ua) &&
      /Safari/.test(ua) &&
      !/CriOS|FxiOS|OPiOS|mercury/.test(ua)
    );
  }

  private getAudioConstraints(): MediaTrackConstraints {
    // iOS Safari has limited support for advanced audio constraints
    if (this.platform.is('ios') || this.isIOSSafari()) {
      console.log('📱 Using iOS-compatible audio constraints');
      return {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 44100, // iOS prefers 44.1kHz
        sampleSize: 16,
        channelCount: 1, // Mono for better compatibility
      };
    }

    // Default constraints for other platforms
    return {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };
  }

  private async processAudio(
    audioBlob: Blob,
    audioUrl: string,
    lane: 'user' | 'partner'
  ) {
    // Hide ending spinner and show translating spinner
    this.hideSpinner('end');
    this.showSpinner('postTranslation', lane);
    this.currentLane = lane;

    // Set a timeout to ensure cleanup happens even if processing gets stuck
    const cleanupTimeout = setTimeout(() => {
      console.warn('⚠️ Audio processing timeout - forcing cleanup');
      this.hideAllSpinners();
      this.cleanupBuffers();
    }, 30000); // 30 second timeout

    try {
      // Get the target language for transcription
      const transcriptionLanguage =
        lane === 'user'
          ? this.selectedUserLanguage
          : this.selectedPartnerLanguage;

      console.log(
        '🎯 Target language for transcription:',
        transcriptionLanguage
      );
      const systemPrompt = this.getLanguageSystemPrompt(transcriptionLanguage);
      console.log('📝 Language system prompt:', systemPrompt);
      console.log(
        '🔍 System prompt contains WRONG_LANGUAGE_DETECTED:',
        systemPrompt.includes('WRONG_LANGUAGE_DETECTED')
      );

      // Prime the language model specifically for Kyrgyz to prevent Kazakh confusion
      if (transcriptionLanguage === 'ky') {
        console.log(
          '🇰🇬 Priming language model for Kyrgyz to prevent Kazakh confusion...'
        );
        try {
          await this.svc.primeLanguage('ky');
          console.log('✅ Language priming completed for Kyrgyz');
        } catch (error) {
          console.warn(
            '⚠️ Language priming failed, continuing with transcription:',
            error
          );
        }
      }

      const transcriptionResult = await this.svc.transcribe(
        audioBlob,
        lane === 'user',
        transcriptionLanguage,
        this.getLanguageSystemPrompt(transcriptionLanguage)
      );
      let transcribedText = transcriptionResult.text;
      const transcriptionConfidence = transcriptionResult.confidence;

      // Check for wrong language detection from backend
      if (transcriptionResult.wrongLanguage) {
        console.warn(
          '🚫 Wrong language detected by backend:',
          transcriptionResult.message
        );
        this.hideAllSpinners();
        this.cleanupBuffers();
        alert(
          transcriptionResult.message ||
            'Please speak in the selected language.'
        );
        return;
      }

      // Debug logging for transcription issues
      console.log('🎤 TRANSCRIPTION DEBUG:');
      console.log('  - Original audio blob size:', audioBlob.size, 'bytes');
      console.log('  - Audio blob type:', audioBlob.type);
      console.log('  - Transcribed text:', `"${transcribedText}"`);
      console.log('  - Transcription confidence:', transcriptionConfidence);
      console.log('  - Expected language:', transcriptionLanguage);

      if (!transcribedText || transcribedText.trim().length === 0) {
        console.warn('Empty transcription received from API');
        this.hideAllSpinners();
        this.cleanupBuffers(); // Clean up buffers on empty transcription
        alert('Could not transcribe speech. Please try speaking again.');
        return;
      }

      // Check for wrong language detection
      console.log(
        '🔍 Checking for wrong language detection in:',
        transcribedText
      );
      console.log('🔍 Looking for WRONG_LANGUAGE_DETECTED pattern...');
      if (transcribedText.includes('WRONG_LANGUAGE_DETECTED:')) {
        console.warn('🚫 Wrong language detected:', transcribedText);
        this.hideAllSpinners();
        this.cleanupBuffers();

        // Extract the user-friendly message after the colon
        const userMessage =
          transcribedText.split('WRONG_LANGUAGE_DETECTED:')[1]?.trim() ||
          'Please speak in the selected language.';
        console.log('📢 Showing user message:', userMessage);
        alert(userMessage);
        return;
      } else {
        console.log(
          '✅ No wrong language detection - proceeding with normal transcription'
        );
      }

      // Fallback: Frontend language detection if backend doesn't work
      const isWrongLanguage = this.detectWrongLanguageFrontend(
        transcribedText,
        transcriptionLanguage
      );
      if (isWrongLanguage) {
        console.warn('🚫 Frontend wrong language detection triggered');
        this.hideAllSpinners();
        this.cleanupBuffers();

        const userMessage = this.getWrongLanguageMessage(transcriptionLanguage);
        console.log('📢 Showing frontend user message:', userMessage);
        alert(userMessage);
        return;
      }

      // Deadlock detection - check for system errors that could cause deadlocks
      if (this.isDeadlockTranslation(transcribedText)) {
        console.warn('🚫 Deadlock translation detected, stopping process');
        this.hideAllSpinners();
        this.cleanupBuffers();
        alert('Translation deadlock detected. Please try again.');
        return;
      }

      // Language filtering - only display text in the selected language
      const filteredText = this.filterLanguageText(
        transcribedText,
        transcriptionLanguage
      );
      if (!filteredText || filteredText.trim().length === 0) {
        console.warn('No text in selected language detected');
        this.hideAllSpinners();
        this.cleanupBuffers();
        alert(
          `Please speak in ${this.getLanguageName(transcriptionLanguage)} only.`
        );
        return;
      }
      transcribedText = filteredText;

      // Convert Kazakh text to Kyrgyz if detected
      if (transcriptionLanguage === 'ky') {
        const kazakhToKyrgyzMap: { [key: string]: string } = {
          // Common words
          сәлем: 'салам',
          жақсы: 'жакшы',
          рахмет: 'рахмат',
          қалай: 'кантип',
          не: 'эмне',
          қазақ: 'кыргыз',
          қазақша: 'кыргызча',
          қазақстан: 'кыргызстан',
          // Character mappings
          қ: 'к',
          ғ: 'г',
          ә: 'а',
          ө: 'о',
          ү: 'ү',
          і: 'и',
          ұ: 'у', // Kazakh ұ → Kyrgyz у
          һ: 'х', // Kazakh һ → Kyrgyz х
        };

        let convertedText = transcribedText;
        let wasConverted = false;

        // Check for Kazakh indicators and convert them
        for (const [kazakh, kyrgyz] of Object.entries(kazakhToKyrgyzMap)) {
          if (convertedText.includes(kazakh)) {
            convertedText = convertedText.replace(
              new RegExp(kazakh, 'gi'),
              kyrgyz
            );
            wasConverted = true;
          }
        }

        if (wasConverted) {
          console.log(
            '🔄 Converted Kazakh text to Kyrgyz:',
            transcribedText,
            '→',
            convertedText
          );
          // Update the transcribed text with the converted version
          transcribedText = convertedText;
        }

        console.log('✅ Kyrgyz transcription processed:', transcribedText);
      }

      let translation: string;
      let translationTargetLanguage:
        | 'en'
        | 'ko'
        | 'zh'
        | 'ky'
        | 'ru'
        | 'kk'
        | 'tg'
        | 'tk'
        | 'uz';

      if (lane === 'user') {
        translationTargetLanguage = this.selectedPartnerLanguage;
        console.log('🔄 TRANSLATION DEBUG:');
        console.log('  - Source text:', `"${transcribedText}"`);
        console.log('  - Source language:', this.selectedUserLanguage);
        console.log('  - Target language:', translationTargetLanguage);

        translation = await this.svc.translate(
          transcribedText,
          translationTargetLanguage,
          this.selectedUserLanguage
        );

        console.log('  - Translated text:', `"${translation}"`);

        this.currentEnText = transcribedText;
        this.currentEnConfidence = transcriptionConfidence;
        this.currentKyText = translation;
      } else {
        translationTargetLanguage = this.selectedUserLanguage;
        console.log('🔄 TRANSLATION DEBUG:');
        console.log('  - Source text:', `"${transcribedText}"`);
        console.log('  - Source language:', this.selectedPartnerLanguage);
        console.log('  - Target language:', translationTargetLanguage);

        translation = await this.svc.translate(
          transcribedText,
          translationTargetLanguage,
          this.selectedPartnerLanguage
        );

        console.log('  - Translated text:', `"${translation}"`);

        this.currentKyInText = transcribedText;
        this.currentKyConfidence = transcriptionConfidence;
        this.currentEnOutText = translation;
      }

      if (!translation || translation.trim().length === 0) {
        console.warn('Empty translation received from API');
        this.hideAllSpinners();
        this.cleanupBuffers(); // Clean up buffers on empty translation
        alert('Translation failed. Please try speaking again.');
        return;
      }

      // Keep the translating spinner active during TTS
      const ttsResult = await this.svc.tts(
        translation,
        this.speakingSpeed,
        this.selectedVoice
      );

      if (!ttsResult || !ttsResult.audioUrl) {
        console.warn('Empty TTS audio received from API');
        this.hideAllSpinners();
        this.cleanupBuffers(); // Clean up buffers on TTS failure
        alert('Failed to generate audio for translation. Please try again.');
        return;
      }

      // Process audio data
      const audioData = ttsResult.audioData;
      const audioDuration = await this.calculateAudioDuration(
        ttsResult.audioUrl
      );

      // Ensure we have a higher confidence value for better translations
      const transcriptionConf = Math.max(transcriptionConfidence || 0, 0.3);
      const translationConf = this.calculateTranslationConfidence(
        transcribedText,
        translation
      );
      const capturedConfidence = Math.max(
        Math.min(transcriptionConf, translationConf),
        0.9 // Minimum confidence of 90% (increased from 80%)
      );

      const historyEntry: Omit<ConversationHistoryEntry, 'id' | 'timestamp'> = {
        originalText: transcribedText,
        translatedText: translation,
        audioUrl: ttsResult.audioUrl,
        audioData: audioData,
        userLanguage:
          lane === 'user'
            ? this.selectedUserLanguage
            : this.selectedPartnerLanguage,
        targetLanguage:
          lane === 'user'
            ? this.selectedPartnerLanguage
            : this.selectedUserLanguage,
        confidence: capturedConfidence,
        duration: audioDuration,
      };

      this.conversationHistoryService.addConversation(historyEntry);

      // Create ConversationEntry for local arrays
      const conversationEntry: ConversationEntry = {
        id: this.conversationId++,
        original: transcribedText,
        translated: translation,
        timestamp: new Date(),
        audioUrl: ttsResult.audioUrl,
        audioData: audioData,
        userLanguage:
          lane === 'user'
            ? this.selectedUserLanguage
            : this.selectedPartnerLanguage,
        partnerLanguage:
          lane === 'user'
            ? this.selectedPartnerLanguage
            : this.selectedUserLanguage,
        confidence: capturedConfidence,
      };

      this.zone.run(() => {
        if (lane === 'user') {
          this.enConversation.unshift(conversationEntry);
        } else {
          this.kyConversation.unshift(conversationEntry);
        }
        this.cdr.detectChanges();
        this.scrollToLatest(lane);
      });

      this.playAudio(ttsResult.audioUrl);
      this.hideAllSpinners();

      // Clean up buffers after successful translation
      this.cleanupBuffers();
    } catch (error) {
      console.error('Error during audio processing:', error);
      this.hideAllSpinners();
      this.cleanupBuffers(); // Clean up buffers on error
      alert('An error occurred during processing. Please try again.');
    } finally {
      // Clear the timeout since processing is complete
      clearTimeout(cleanupTimeout);

      // ALWAYS hide spinners and clean up buffers when end button is clicked
      this.hideAllSpinners();
      this.cleanupBuffers();

      console.log('🧹 Audio processing completed - buffers cleared');
    }
  }

  private async processCompleteSentence() {
    const sentence = this.sentenceBuffer.trim();
    if (!sentence) return;

    // Check if sentence is too short or contains only whitespace/special characters
    if (sentence.length < 2 || /^[\s\.,!?\-_]+$/.test(sentence)) {
      console.log('Empty or invalid speech detected, skipping translation');
      this.sentenceBuffer = '';
      return;
    }

    // Clear the sentence buffer immediately to prepare for next sentence
    this.sentenceBuffer = '';

    try {
      if (this.currentLane === 'user') {
        // Hide ending spinner and show translating spinner
        this.hideSpinner('end');
        this.showSpinner('postTranslation', 'user');

        // Translate user's language to partner's language with automatic spinner
        const translation = await this.svc.translate(
          sentence,
          this.selectedPartnerLanguage
        );

        // Check if translation is empty or invalid
        if (!translation || translation.trim().length === 0) {
          console.warn('Empty translation received from API');
          this.hideAllSpinners();
          alert('Translation failed. Please try speaking again.');
          return;
        }

        this.currentEnText = sentence;
        this.currentKyText = translation;

        // Hide post-translation spinner and show intermediate spinner
        this.hideSpinner('postTranslation');
        this.showSpinner('intermediate', 'user');
        const ttsResult = await this.svc.tts(
          translation,
          this.speakingSpeed,
          this.selectedVoice
        );
        this.hideSpinner('intermediate');

        if (!ttsResult || !ttsResult.audioUrl) {
          console.warn('Empty TTS audio received from API');
          this.hideAllSpinners();
          alert('Failed to generate audio for translation. Please try again.');
          return;
        }

        // Show finalizing spinner
        this.showSpinner('finalizing', 'user');
        const audioData = ttsResult.audioData;
        const audioDuration = await this.calculateAudioDuration(
          ttsResult.audioUrl
        );
        this.hideSpinner('finalizing');

        const capturedConfidence = this.calculateTranslationConfidence(
          sentence,
          translation
        );

        const historyEntry: Omit<ConversationHistoryEntry, 'id' | 'timestamp'> =
          {
            originalText: sentence,
            translatedText: translation,
            audioUrl: ttsResult.audioUrl,
            audioData: audioData,
            userLanguage: this.selectedUserLanguage,
            targetLanguage: this.selectedPartnerLanguage,
            confidence: capturedConfidence,
            duration: audioDuration,
          };

        this.conversationHistoryService.addConversation(historyEntry);

        const conversationEntry: ConversationEntry = {
          id: this.conversationId++,
          original: sentence,
          translated: translation,
          timestamp: new Date(),
          audioUrl: ttsResult.audioUrl,
          audioData: audioData,
          userLanguage: this.selectedUserLanguage,
          partnerLanguage: this.selectedPartnerLanguage,
          confidence: capturedConfidence,
        };

        this.zone.run(() => {
          this.enConversation.unshift(conversationEntry);
          this.cdr.detectChanges();
          this.scrollToLatest('user');
        });

        this.playAudio(ttsResult.audioUrl);
        this.hideAllSpinners();
      } else {
        // Hide ending spinner and show translating spinner
        this.hideSpinner('end');
        this.showSpinner('postTranslation', 'partner');

        // Partner spoke their language - translate to user's language with automatic spinner
        const translation = await this.svc.translate(
          sentence,
          this.selectedUserLanguage
        );

        // Check if translation is empty or invalid
        if (!translation || translation.trim().length === 0) {
          console.warn('Empty translation received from API');
          this.hideAllSpinners();
          alert('Translation failed. Please try speaking again.');
          return;
        }

        this.currentKyInText = sentence;
        this.currentEnOutText = translation;

        // Hide post-translation spinner and show intermediate spinner
        this.hideSpinner('postTranslation');
        this.showSpinner('intermediate', 'partner');
        const ttsResult = await this.svc.tts(
          translation,
          this.speakingSpeed,
          this.selectedVoice
        );
        this.hideSpinner('intermediate');

        if (!ttsResult || !ttsResult.audioUrl) {
          console.warn('Empty TTS audio received from API');
          this.hideAllSpinners();
          alert('Failed to generate audio for translation. Please try again.');
          return;
        }

        // Show finalizing spinner
        this.showSpinner('finalizing', 'partner');
        const audioData = ttsResult.audioData;
        const audioDuration = await this.calculateAudioDuration(
          ttsResult.audioUrl
        );
        this.hideSpinner('finalizing');

        const capturedConfidence = this.calculateTranslationConfidence(
          sentence,
          translation
        );

        const historyEntry: Omit<ConversationHistoryEntry, 'id' | 'timestamp'> =
          {
            originalText: sentence,
            translatedText: translation,
            audioUrl: ttsResult.audioUrl,
            audioData: audioData,
            userLanguage: this.selectedPartnerLanguage, // Partner's original language
            targetLanguage: this.selectedUserLanguage, // Partner's translated language (user's language)
            confidence: capturedConfidence,
            duration: audioDuration,
          };

        this.conversationHistoryService.addConversation(historyEntry);

        const conversationEntry: ConversationEntry = {
          id: this.conversationId++,
          original: sentence,
          translated: translation,
          timestamp: new Date(),
          audioUrl: ttsResult.audioUrl,
          audioData: audioData,
          userLanguage: this.selectedPartnerLanguage,
          partnerLanguage: this.selectedUserLanguage,
          confidence: capturedConfidence,
        };

        this.zone.run(() => {
          this.kyConversation.unshift(conversationEntry);
          this.cdr.detectChanges();
          this.scrollToLatest('partner');
        });

        this.playAudio(ttsResult.audioUrl);
        this.hideAllSpinners();
      }
    } catch (error) {
      console.error('Error during sentence processing:', error);
      this.hideAllSpinners();
      this.cleanupBuffers(); // Clean up buffers on error
      alert('An error occurred during processing. Please try again.');
    }
  }

  async translateUserText() {
    if (!this.userTextInput.trim()) {
      console.warn('No text to translate');
      return;
    }

    const text = this.userTextInput.trim();

    // Check word limit (200 words)
    const wordCount = text.split(/\s+/).length;
    if (wordCount > 200) {
      alert('Text exceeds 200 words limit. Please shorten your message.');
      return;
    }

    // Check if text is too short or contains only whitespace/special characters
    if (text.length < 2 || /^[\s\.,!?\-_]+$/.test(text)) {
      console.log('Empty or invalid text detected, skipping translation');
      this.userTextInput = '';
      return;
    }

    console.log(`Translating user text: "${text}"`);

    // Set current lane to user for spinner display
    this.currentLane = 'user';

    try {
      // Show translating spinner
      this.showSpinner('postTranslation', 'user');

      // Use the same translation flow as speech
      const translation = await this.svc.translate(
        text,
        this.selectedPartnerLanguage,
        this.selectedUserLanguage
      );

      // Check if translation is empty or invalid
      if (!translation || translation.trim().length === 0) {
        console.warn('Empty translation received from API');
        this.hideAllSpinners();
        alert('Translation failed. Please try again.');
        return;
      }

      this.currentEnText = text;
      this.currentKyText = translation;

      // Hide post-translation spinner and show intermediate spinner
      this.hideSpinner('postTranslation');
      this.showSpinner('intermediate', 'user');
      const ttsResult = await this.svc.tts(
        translation,
        this.speakingSpeed,
        this.selectedVoice
      );
      this.hideSpinner('intermediate');

      if (!ttsResult || !ttsResult.audioUrl) {
        console.warn('Empty TTS audio received from API');
        this.hideAllSpinners();
        alert('Failed to generate audio for translation. Please try again.');
        return;
      }

      // Show finalizing spinner
      this.showSpinner('finalizing', 'user');
      const audioData = ttsResult.audioData;
      const audioDuration = await this.calculateAudioDuration(
        ttsResult.audioUrl
      );
      this.hideSpinner('finalizing');

      const capturedConfidence = this.calculateTranslationConfidence(
        text,
        translation
      );

      const historyEntry: Omit<ConversationHistoryEntry, 'id' | 'timestamp'> = {
        originalText: text,
        translatedText: translation,
        audioUrl: ttsResult.audioUrl,
        audioData: audioData,
        userLanguage: this.selectedUserLanguage,
        targetLanguage: this.selectedPartnerLanguage,
        confidence: capturedConfidence,
        duration: audioDuration,
      };

      this.conversationHistoryService.addConversation(historyEntry);

      const conversationEntry: ConversationEntry = {
        id: this.conversationId++,
        original: text,
        translated: translation,
        timestamp: new Date(),
        audioUrl: ttsResult.audioUrl,
        audioData: audioData,
        userLanguage: this.selectedUserLanguage,
        partnerLanguage: this.selectedPartnerLanguage,
        confidence: this.calculateTranslationConfidence(text, translation),
      };

      this.zone.run(() => {
        this.enConversation.unshift(conversationEntry);
        this.userTextInput = ''; // Clear input after translation
        this.cdr.detectChanges();
        this.scrollToLatest('user');
      });

      this.playAudio(ttsResult.audioUrl);
      this.hideAllSpinners();
    } catch (error) {
      console.error('Error translating user text:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown',
      });
      this.hideAllSpinners();
      alert(
        `Failed to translate text: ${
          error instanceof Error ? error.message : String(error)
        }. Please try again.`
      );
    }
  }

  async translatePartnerText() {
    if (!this.partnerTextInput.trim()) {
      console.warn('No text to translate');
      return;
    }

    const text = this.partnerTextInput.trim();

    // Check word limit (200 words)
    const wordCount = text.split(/\s+/).length;
    if (wordCount > 200) {
      alert('Text exceeds 200 words limit. Please shorten your message.');
      return;
    }

    // Check if text is too short or contains only whitespace/special characters
    if (text.length < 2 || /^[\s\.,!?\-_]+$/.test(text)) {
      console.log('Empty or invalid text detected, skipping translation');
      this.partnerTextInput = '';
      return;
    }

    console.log(`Translating partner text: "${text}"`);

    // Set current lane to partner for spinner display
    this.currentLane = 'partner';

    try {
      // Show translating spinner
      this.showSpinner('postTranslation', 'partner');

      // Use the same translation flow as speech
      const translation = await this.svc.translate(
        text,
        this.selectedUserLanguage,
        this.selectedPartnerLanguage
      );

      // Check if translation is empty or invalid
      if (!translation || translation.trim().length === 0) {
        console.warn('Empty translation received from API');
        this.hideAllSpinners();
        alert('Translation failed. Please try again.');
        return;
      }

      this.currentKyInText = text;
      this.currentEnOutText = translation;

      // Hide post-translation spinner and show intermediate spinner
      this.hideSpinner('postTranslation');
      this.showSpinner('intermediate', 'partner');
      const ttsResult = await this.svc.tts(
        translation,
        this.speakingSpeed,
        this.selectedVoice
      );
      this.hideSpinner('intermediate');

      if (!ttsResult || !ttsResult.audioUrl) {
        console.warn('Empty TTS audio received from API');
        this.hideAllSpinners();
        alert('Failed to generate audio for translation. Please try again.');
        return;
      }

      // Show finalizing spinner
      this.showSpinner('finalizing', 'partner');
      const audioData = ttsResult.audioData;
      const audioDuration = await this.calculateAudioDuration(
        ttsResult.audioUrl
      );
      this.hideSpinner('finalizing');

      const capturedConfidence = this.calculateTranslationConfidence(
        text,
        translation
      );

      const historyEntry: Omit<ConversationHistoryEntry, 'id' | 'timestamp'> = {
        originalText: text,
        translatedText: translation,
        audioUrl: ttsResult.audioUrl,
        audioData: audioData,
        userLanguage: this.selectedPartnerLanguage, // Partner's original language
        targetLanguage: this.selectedUserLanguage, // Partner's translated language (user's language)
        confidence: capturedConfidence,
        duration: audioDuration,
      };

      this.conversationHistoryService.addConversation(historyEntry);

      const conversationEntry: ConversationEntry = {
        id: this.conversationId++,
        original: text,
        translated: translation,
        timestamp: new Date(),
        audioUrl: ttsResult.audioUrl,
        audioData: audioData,
        userLanguage: this.selectedPartnerLanguage,
        partnerLanguage: this.selectedUserLanguage,
        confidence: this.calculateTranslationConfidence(text, translation),
      };

      this.zone.run(() => {
        this.kyConversation.unshift(conversationEntry);
        this.partnerTextInput = ''; // Clear input after translation
        this.cdr.detectChanges();
        this.scrollToLatest('partner');
      });

      this.playAudio(ttsResult.audioUrl);
      this.hideAllSpinners();
    } catch (error) {
      console.error('Error translating partner text:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown',
      });
      this.hideAllSpinners();
      alert(
        `Failed to translate text: ${
          error instanceof Error ? error.message : String(error)
        }. Please try again.`
      );
    }
  }

  // Audio duration calculation
  private async calculateAudioDuration(audioUrl: string): Promise<number> {
    return new Promise((resolve) => {
      const audio = new Audio(audioUrl);
      audio.addEventListener('loadedmetadata', () => {
        resolve(audio.duration);
      });
      audio.addEventListener('error', () => {
        resolve(0);
      });
    });
  }

  // Audio playback
  private currentAudio?: HTMLAudioElement;

  playAudio(audioUrl: string) {
    // Stop any currently playing audio
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
    }

    this.currentAudio = new Audio(audioUrl);
    this.currentAudio.playbackRate = this.speakingSpeed;

    this.currentAudio.play().catch((error) => {
      console.error('Audio playback failed:', error);
      alert('Unable to play audio: ' + error.message);
    });

    // Clean up when audio ends
    this.currentAudio.addEventListener('ended', () => {
      this.currentAudio = undefined;
    });
  }

  // Confidence calculation (simplified for client-side estimation)
  private calculateTranslationConfidence(
    originalText: string,
    translatedText: string
  ): number {
    if (!originalText || !translatedText) return 0;

    const originalWords = originalText.split(/\s+/).filter(Boolean);
    const translatedWords = translatedText.split(/\s+/).filter(Boolean);

    const lengthRatio =
      Math.min(originalWords.length, translatedWords.length) /
      Math.max(originalWords.length, translatedWords.length);

    // Simple check for significant content
    const hasContent = originalWords.length > 2 && translatedWords.length > 2;

    // Assign a base confidence if content exists and ratio is reasonable
    let confidence = 0.85; // Default confidence for any translation (increased from 0.6)
    if (hasContent && lengthRatio > 0.5) {
      confidence = 0.95; // High confidence for good translations (increased from 0.8)
    } else if (hasContent && lengthRatio > 0.2) {
      confidence = 0.9; // Medium confidence for reasonable translations (increased from 0.6)
    } else if (hasContent) {
      confidence = 0.8; // Lower confidence for shorter/less matching translations (increased from 0.4)
    }

    // Further adjust based on length difference (less penalizing)
    const lengthDiff = Math.abs(originalText.length - translatedText.length);
    if (lengthDiff > originalText.length * 0.7) {
      confidence *= 0.9; // Less penalizing for large length differences (increased from 0.8)
    }

    return confidence; // Return value between 0-1, not 0-100
  }

  // Auto-scroll to latest message
  private scrollToLatest(lane?: 'user' | 'partner') {
    this.zone.runOutsideAngular(() => {
      setTimeout(() => {
        // First, try to scroll to the current translation display (most recent)
        const currentTranslations = document.querySelectorAll(
          '.current-translation'
        );
        if (currentTranslations.length > 0) {
          const latestCurrentTranslation =
            currentTranslations[currentTranslations.length - 1];
          latestCurrentTranslation.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });

          // Add a highlight effect to draw attention
          latestCurrentTranslation.classList.add('highlight-new');
          setTimeout(() => {
            latestCurrentTranslation.classList.remove('highlight-new');
          }, 2000);
        }

        // Then scroll to the latest conversation item in the appropriate lane
        let conversationItems;
        if (lane === 'user') {
          // Focus on user conversation (English)
          conversationItems = document.querySelectorAll(
            '#en-conversation .conversation-item'
          );
        } else if (lane === 'partner') {
          // Focus on partner conversation (Kyrgyz)
          conversationItems = document.querySelectorAll(
            '#ky-conversation .conversation-item'
          );
        } else {
          // Default: focus on all conversation items
          conversationItems = document.querySelectorAll('.conversation-item');
        }

        if (conversationItems.length > 0) {
          const latestConversationItem = conversationItems[0]; // First item is now the latest
          latestConversationItem.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });

          // Add a highlight effect to draw attention
          latestConversationItem.classList.add('highlight-new');
          setTimeout(() => {
            latestConversationItem.classList.remove('highlight-new');
          }, 2000);
        }

        // Also scroll the conversation containers to top (since latest items are now at the top)
        const enConversation = document.getElementById('en-conversation');
        const kyConversation = document.getElementById('ky-conversation');

        if (lane === 'user' && enConversation) {
          enConversation.scrollTop = 0;
        } else if (lane === 'partner' && kyConversation) {
          kyConversation.scrollTop = 0;
        } else {
          // Default: scroll both containers
          if (enConversation) {
            enConversation.scrollTop = 0;
          }
          if (kyConversation) {
            kyConversation.scrollTop = 0;
          }
        }
      }, 300); // Increased delay to ensure DOM is fully updated
    });
  }

  /**
   * Clean up all buffers and reset state for a fresh start
   */
  private cleanupBuffers() {
    console.log('🧹 Cleaning up buffers and resetting state...');

    // Clear all text buffers
    this.sentenceBuffer = '';
    this.currentEnText = '';
    this.currentKyText = '';
    this.currentKyInText = '';
    this.currentEnOutText = '';

    // Reset confidence values
    this.currentEnConfidence = 0;
    this.currentKyConfidence = 0;

    // Clear audio chunks
    this.chunks = [];

    // Stop any ongoing recording
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // Stop media stream
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = undefined;
    }

    // Reset recording state
    this.isRecording = false;
    this.currentLane = null;

    // Hide all spinners
    this.hideAllSpinners();

    // Trigger change detection
    this.cdr.detectChanges();

    console.log('✅ Buffer cleanup completed');
  }

  /**
   * Get language-specific system prompt for transcription
   */
  private getLanguageSystemPrompt(language: string): string {
    const languagePrompts: { [key: string]: string } = {
      en: `You are a speech-to-text system for a real-time translation app. ONLY transcribe English speech. If the speech is NOT in English, return "WRONG_LANGUAGE_DETECTED: Please speak in English" instead of transcribing. Return only the English text that was spoken. This transcription will be used for translation purposes.`,
      ko: `You are a speech-to-text system for a real-time translation app. ONLY transcribe Korean speech (한국어). If the speech is NOT in Korean, return "WRONG_LANGUAGE_DETECTED: 한국어로 말해주세요" instead of transcribing. Return only the Korean text that was spoken. This transcription will be used for translation purposes.`,
      zh: `You are a speech-to-text system for a real-time translation app. ONLY transcribe Chinese speech (中文). If the speech is NOT in Chinese, return "WRONG_LANGUAGE_DETECTED: 请说中文" instead of transcribing. Return only the Chinese text that was spoken. This transcription will be used for translation purposes.`,
      ky: `You are a speech-to-text system for a real-time translation app. ONLY transcribe Kyrgyz speech (Кыргызча). If the speech is NOT in Kyrgyz (especially if it sounds like Kazakh), return "WRONG_LANGUAGE_DETECTED: Кыргызча сүйлөңүз" instead of transcribing. Return only the Kyrgyz text that was spoken. This transcription will be used for translation purposes.`,
      ru: `You are a speech-to-text system for a real-time translation app. ONLY transcribe Russian speech (Русский). If the speech is NOT in Russian, return "WRONG_LANGUAGE_DETECTED: Говорите по-русски" instead of transcribing. Return only the Russian text that was spoken. This transcription will be used for translation purposes.`,
      kk: `You are a speech-to-text system for a real-time translation app. ONLY transcribe Kazakh speech (Қазақша). If the speech is NOT in Kazakh (especially if it sounds like Kyrgyz), return "WRONG_LANGUAGE_DETECTED: Қазақша сөйлеңіз" instead of transcribing. Return only the Kazakh text that was spoken. This transcription will be used for translation purposes.`,
      tg: `You are a speech-to-text system for a real-time translation app. ONLY transcribe Tajik speech (Тоҷикӣ). If the speech is NOT in Tajik, return "WRONG_LANGUAGE_DETECTED: Тоҷикӣ гап занед" instead of transcribing. Return only the Tajik text that was spoken. This transcription will be used for translation purposes.`,
      tk: `You are a speech-to-text system for a real-time translation app. ONLY transcribe Turkmen speech (Türkmençe). If the speech is NOT in Turkmen, return "WRONG_LANGUAGE_DETECTED: Türkmençe gürleň" instead of transcribing. Return only the Turkmen text that was spoken. This transcription will be used for translation purposes.`,
      uz: `You are a speech-to-text system for a real-time translation app. ONLY transcribe Uzbek speech (O'zbekcha). If the speech is NOT in Uzbek, return "WRONG_LANGUAGE_DETECTED: O'zbekcha gapiring" instead of transcribing. Return only the Uzbek text that was spoken. This transcription will be used for translation purposes.`,
    };

    return (
      languagePrompts[language] ||
      'You are a speech-to-text system. Transcribe the speech accurately.'
    );
  }

  // Track by function for ngFor
  trackByEntryId(index: number, entry: ConversationEntry): number {
    return entry.id;
  }

  // Frontend language detection fallback
  private detectWrongLanguageFrontend(
    text: string,
    expectedLanguage: string
  ): boolean {
    console.log(
      '🔍 Frontend language detection for:',
      text,
      'expected:',
      expectedLanguage
    );

    // Simple heuristics for language detection
    const languagePatterns = {
      en: {
        // English patterns - more comprehensive
        positive: /[a-zA-Z]/, // Any Latin characters
        positive2:
          /\b(the|and|or|but|in|on|at|to|for|of|with|by|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|can|must|shall|hello|hi|yes|no|ok|okay|good|bad|thank|thanks|please|sorry|excuse|help|what|where|when|why|how|who|which|this|that|here|there|now|then|today|tomorrow|yesterday|morning|afternoon|evening|night|time|day|week|month|year|name|age|old|new|big|small|hot|cold|fast|slow|easy|hard|happy|sad|angry|tired|hungry|thirsty|sick|well|fine|great|awesome|amazing|wonderful|beautiful|nice|lovely|perfect|excellent|fantastic|terrible|awful|horrible|disgusting|delicious|tasty|sweet|sour|bitter|spicy|salty|fresh|clean|dirty|wet|dry|full|empty|open|closed|free|busy|ready|finished|done|start|stop|go|come|leave|stay|wait|hurry|slow|quick|fast|slowly|quickly|carefully|easily|hardly|really|very|quite|pretty|rather|somewhat|totally|completely|absolutely|definitely|probably|maybe|perhaps|certainly|surely|obviously|clearly|exactly|precisely|approximately|about|around|nearly|almost|exactly|just|only|even|still|yet|already|soon|later|early|late|always|never|sometimes|often|usually|rarely|seldom|frequently|occasionally|constantly|continuously|immediately|instantly|suddenly|gradually|slowly|quickly|carefully|easily|hardly|really|very|quite|pretty|rather|somewhat|totally|completely|absolutely|definitely|probably|maybe|perhaps|certainly|surely|obviously|clearly|exactly|precisely|approximately|about|around|nearly|almost|exactly|just|only|even|still|yet|already|soon|later|early|late|always|never|sometimes|often|usually|rarely|seldom|frequently|occasionally|constantly|continuously|immediately|instantly|suddenly|gradually)\b/i,
        // Non-English patterns
        negative: /[а-яё]/i, // Cyrillic
        negative2: /[一-龯]/, // Chinese
        negative3: /[가-힣]/, // Korean
        negative4: /[ا-ي]/, // Arabic
      },
      ky: {
        // Kyrgyz patterns
        positive: /[а-яё]/i, // Cyrillic
        positive2:
          /\b(салам|рахмат|жакшы|кантип|эмне|мен|сен|ал|биз|сиз|алар|бул|ошол|мына|анда|бул жерде|ушундай|ошондой)\b/i,
        // Non-Kyrgyz patterns
        negative:
          /\b(the|and|or|but|in|on|at|to|for|of|with|by|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|can|must|shall)\b/i,
        negative2: /[一-龯]/, // Chinese
        negative3: /[가-힣]/, // Korean
      },
      ko: {
        // Korean patterns
        positive: /[가-힣]/, // Korean characters
        positive2:
          /\b(안녕|감사|좋다|어떻게|무엇|나|너|우리|당신|그들|이것|저것|여기|거기|이런|저런)\b/i,
        // Non-Korean patterns
        negative:
          /\b(the|and|or|but|in|on|at|to|for|of|with|by|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|can|must|shall)\b/i,
        negative2: /[а-яё]/i, // Cyrillic
        negative3: /[一-龯]/, // Chinese
      },
      zh: {
        // Chinese patterns
        positive: /[一-龯]/, // Chinese characters
        positive2:
          /\b(你好|谢谢|好|怎么|什么|我|你|我们|你们|他们|这个|那个|这里|那里|这样|那样)\b/i,
        // Non-Chinese patterns
        negative:
          /\b(the|and|or|but|in|on|at|to|for|of|with|by|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|can|must|shall)\b/i,
        negative3: /[가-힣]/, // Korean
        negative4: /[а-яё]/i, // Cyrillic
      },
      ru: {
        // Russian patterns
        positive: /[а-яё]/i, // Cyrillic
        positive2:
          /\b(привет|спасибо|хорошо|как|что|я|ты|мы|вы|они|это|то|здесь|там|так|также)\b/i,
        // Non-Russian patterns
        negative:
          /\b(the|and|or|but|in|on|at|to|for|of|with|by|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|can|must|shall)\b/i,
        negative2: /[一-龯]/, // Chinese
        negative3: /[가-힣]/, // Korean
      },
    };

    const patterns =
      languagePatterns[expectedLanguage as keyof typeof languagePatterns];
    if (!patterns) {
      console.log('❌ No patterns found for language:', expectedLanguage);
      return false;
    }

    // Check for positive patterns (should be present)
    const hasPositive =
      patterns.positive?.test(text) || (patterns as any).positive2?.test(text);

    // Check for negative patterns (should NOT be present)
    const hasNegative =
      patterns.negative?.test(text) ||
      (patterns as any).negative2?.test(text) ||
      (patterns as any).negative3?.test(text) ||
      (patterns as any).negative4?.test(text);

    console.log('🔍 Language detection results:', {
      text: text.substring(0, 50) + '...',
      expectedLanguage,
      hasPositive,
      hasNegative,
      positivePattern: patterns.positive?.source,
      negativePattern: patterns.negative?.source,
    });

    // If we expect a specific language but find negative patterns, it's wrong language
    if (hasNegative) {
      console.log('❌ Wrong language detected: found negative patterns');
      return true;
    }

    // For English, be more lenient - if it contains Latin characters, it's likely English
    if (expectedLanguage === 'en') {
      if (hasPositive) {
        console.log('✅ English detected: found Latin characters');
        return false;
      }
      // Only reject if it's very short and has no Latin characters
      if (text.length < 3) {
        console.log('❌ English rejected: too short and no Latin characters');
        return true;
      }
    } else {
      // For other languages, require positive patterns for longer text
      if (!hasPositive && text.length > 10) {
        console.log('❌ Wrong language detected: no positive patterns found');
        return true;
      }
    }

    console.log('✅ Language appears correct');
    return false;
  }

  private getWrongLanguageMessage(language: string): string {
    const messages = {
      en: 'Please speak in English',
      ko: '한국어로 말해주세요',
      zh: '请说中文',
      ky: 'Кыргызча сүйлөңүз',
      ru: 'Говорите по-русски',
      kk: 'Қазақша сөйлеңіз',
      tg: 'Тоҷикӣ гап занед',
      tk: 'Türkmençe gürleň',
      uz: "O'zbekcha gapiring",
    };
    return (
      messages[language as keyof typeof messages] ||
      'Please speak in the selected language.'
    );
  }

  // Helper methods for template
  getUserLanguageName(lang: string): string {
    const option = this.userLanguages.find((l) => l.value === lang);
    return option ? option.label : lang;
  }

  getPartnerLanguageName(lang: string): string {
    const option = this.partnerLanguages.find((l) => l.value === lang);
    return option ? option.label : lang;
  }

  // Clear methods
  clearUserText() {
    console.log('🧹 clearUserText() called');
    console.log('Before clear - userTextInput:', this.userTextInput);
    console.log('Before clear - currentEnText:', this.currentEnText);
    console.log('Before clear - currentKyText:', this.currentKyText);
    console.log(
      'Before clear - enConversation length:',
      this.enConversation.length
    );
    console.log('Recording state:', this.recording);

    // Clear text input
    this.userTextInput = '';

    // Clear current translation display
    this.currentEnText = '';
    this.currentKyText = '';
    this.currentEnConfidence = 0;

    // Clear conversation history for user lane
    this.enConversation = [];

    console.log('After clear - userTextInput:', this.userTextInput);
    console.log('After clear - currentEnText:', this.currentEnText);
    console.log('After clear - currentKyText:', this.currentKyText);
    console.log(
      'After clear - enConversation length:',
      this.enConversation.length
    );

    this.cdr.detectChanges();
    console.log('✅ clearUserText() completed');
  }

  clearPartnerText() {
    console.log('🧹 clearPartnerText() called');
    console.log('Before clear - partnerTextInput:', this.partnerTextInput);
    console.log('Before clear - currentKyInText:', this.currentKyInText);
    console.log('Before clear - currentEnOutText:', this.currentEnOutText);
    console.log(
      'Before clear - kyConversation length:',
      this.kyConversation.length
    );
    console.log('Recording state:', this.recording);

    // Clear text input
    this.partnerTextInput = '';

    // Clear current translation display
    this.currentKyInText = '';
    this.currentEnOutText = '';
    this.currentKyConfidence = 0;

    // Clear conversation history for partner lane
    this.kyConversation = [];

    console.log('After clear - partnerTextInput:', this.partnerTextInput);
    console.log('After clear - currentKyInText:', this.currentKyInText);
    console.log('After clear - currentEnOutText:', this.currentEnOutText);
    console.log(
      'After clear - kyConversation length:',
      this.kyConversation.length
    );

    this.cdr.detectChanges();
    console.log('✅ clearPartnerText() completed');
  }

  clearAllConversations() {
    this.enConversation = [];
    this.kyConversation = [];
    this.cdr.detectChanges();
  }

  // Audio playback for history
  onPlayHistoryAudio(conversation: ConversationHistoryEntry) {
    console.log('onPlayHistoryAudio called with conversation:', conversation);
    console.log('audioData exists:', !!conversation.audioData);
    console.log('audioUrl exists:', !!conversation.audioUrl);

    if (conversation.audioData) {
      // Convert base64 to blob URL
      const audioBlob = this.base64ToBlob(conversation.audioData);
      const audioUrl = URL.createObjectURL(audioBlob);
      console.log('Created audio URL from base64:', audioUrl);
      this.playAudio(audioUrl);
    } else if (conversation.audioUrl) {
      console.log('Using existing audio URL:', conversation.audioUrl);
      this.playAudio(conversation.audioUrl);
    } else {
      console.log('No audio data available for this conversation');
      alert('No audio available for this conversation');
    }
  }

  private base64ToBlob(base64Data: string): Blob {
    // Remove data URL prefix if present
    const base64String = base64Data.includes(',')
      ? base64Data.split(',')[1]
      : base64Data;

    try {
      const byteCharacters = atob(base64String);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      return new Blob([byteArray], { type: 'audio/mpeg' });
    } catch (error) {
      console.error('Error decoding base64 audio data:', error);
      throw new Error('Invalid base64 audio data');
    }
  }

  ngOnDestroy() {
    this.stopRecording();
    if (this.translationSubscription) {
      this.translationSubscription.unsubscribe();
    }
  }

  private setupTranslation() {
    this.loadTranslations();
    this.translationSubscription =
      this.translationService.currentLanguage$.subscribe(() => {
        this.loadTranslations();
      });
  }

  private loadTranslations() {
    this.translations = this.translationService.getAllTranslations();
  }

  /**
   * Detects if translation is in a deadlock state due to system errors
   */
  private isDeadlockTranslation(text: string): boolean {
    const lowerText = text.toLowerCase().trim();

    // Deadlock indicators - patterns that suggest system errors causing translation loops
    const deadlockPatterns = [
      // Error messages that could cause loops
      'error occurred',
      'translation failed',
      'processing error',
      'system error',
      'deadlock',
      'timeout',
      'connection failed',
      'api error',
      'service unavailable',
      'internal server error',

      // Repeated error patterns
      'error error',
      'failed failed',
      'timeout timeout',
      'error processing error',

      // Empty or corrupted responses
      text.length === 0,
      text.trim().length === 0,
      text === 'null',
      text === 'undefined',
      text === 'error',
      text === 'failed',

      // Infinite loop indicators
      text.includes('processing') && text.includes('error'),
      text.includes('translation') && text.includes('failed'),
      text.includes('system') && text.includes('error'),

      // Very long error messages (likely system generated)
      text.length > 1000 && lowerText.includes('error'),

      // Repeated identical text (suggests stuck loop)
      this.isRepeatedText(text),
    ];

    // Check for deadlock patterns
    for (const pattern of deadlockPatterns) {
      if (typeof pattern === 'string' && lowerText.includes(pattern)) {
        console.log('🚫 Deadlock pattern detected:', pattern);
        return true;
      }
      if (typeof pattern === 'boolean' && pattern) {
        console.log('🚫 Deadlock condition detected');
        return true;
      }
    }

    return false;
  }

  /**
   * Checks if text is repeated (indicates stuck loop)
   */
  private isRepeatedText(text: string): boolean {
    if (text.length < 10) return false;

    // Check for repeated phrases
    const words = text.split(' ');
    if (words.length < 3) return false;

    // Check if the same phrase repeats multiple times
    const phrase = words.slice(0, 3).join(' ');
    const remainingText = words.slice(3).join(' ');

    return (
      remainingText.includes(phrase) && remainingText.split(phrase).length > 2
    );
  }

  /**
   * Filters text to only include content in the selected language
   */
  private filterLanguageText(text: string, targetLanguage: string): string {
    // For now, we'll use a simple approach and let the system prompt handle language filtering
    // The system prompt should already be configured to only transcribe the target language
    // This method can be enhanced with more sophisticated language detection if needed

    // Basic validation - check if text contains only expected characters for the language
    switch (targetLanguage) {
      case 'en':
        // English - allow Latin characters, numbers, basic punctuation
        if (/^[a-zA-Z0-9\s.,!?\-'"]+$/.test(text)) {
          return text;
        }
        break;
      case 'ko':
        // Korean - allow Hangul, Latin characters, numbers, basic punctuation
        if (/^[가-힣a-zA-Z0-9\s.,!?\-'"]+$/.test(text)) {
          return text;
        }
        break;
      case 'zh':
        // Chinese - allow Chinese characters, Latin characters, numbers, basic punctuation
        if (/^[\u4e00-\u9fff\u3400-\u4dbfa-zA-Z0-9\s.,!?\-'"]+$/.test(text)) {
          return text;
        }
        break;
      case 'ru':
        // Russian - allow Cyrillic, Latin characters, numbers, basic punctuation
        if (/^[а-яА-Яa-zA-Z0-9\s.,!?\-'"]+$/.test(text)) {
          return text;
        }
        break;
      case 'ky':
        // Kyrgyz - allow Cyrillic, Latin characters, numbers, basic punctuation
        if (/^[а-яА-Яa-zA-Z0-9\s.,!?\-'"]+$/.test(text)) {
          return text;
        }
        break;
      case 'kk':
        // Kazakh - allow Cyrillic, Latin characters, numbers, basic punctuation
        if (/^[а-яА-Яa-zA-Z0-9\s.,!?\-'"]+$/.test(text)) {
          return text;
        }
        break;
      case 'tg':
        // Tajik - allow Cyrillic, Latin characters, numbers, basic punctuation
        if (/^[а-яА-Яa-zA-Z0-9\s.,!?\-'"]+$/.test(text)) {
          return text;
        }
        break;
      case 'tk':
        // Turkmen - allow Latin characters, numbers, basic punctuation
        if (/^[a-zA-Z0-9\s.,!?\-'"]+$/.test(text)) {
          return text;
        }
        break;
      case 'uz':
        // Uzbek - allow Latin characters, numbers, basic punctuation
        if (/^[a-zA-Z0-9\s.,!?\-'"]+$/.test(text)) {
          return text;
        }
        break;
    }

    // If no specific pattern matches, return the original text
    // The system prompt should handle the actual language filtering
    return text;
  }

  /**
   * Gets the display name for a language code
   */
  private getLanguageName(languageCode: string): string {
    const languageNames: { [key: string]: string } = {
      en: 'English',
      ko: 'Korean',
      zh: 'Chinese',
      ru: 'Russian',
      ky: 'Kyrgyz',
      kk: 'Kazakh',
      tg: 'Tajik',
      tk: 'Turkmen',
      uz: 'Uzbek',
    };
    return languageNames[languageCode] || languageCode;
  }
}
