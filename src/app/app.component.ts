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
  private speechActivityTimeout?: any;
  private lastSpeechTime = 0;
  private readonly SPEECH_SILENCE_THRESHOLD = 3000; // 3 seconds of silence before stopping

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

      // Update conversation history when user changes
      if (user && user.userId) {
        console.log(
          '👤 User logged in, loading their conversation history:',
          user.userId
        );
        this.conversationHistoryService.setCurrentUser(user.userId);
      } else {
        console.log('👤 User logged out, resetting to anonymous history');
        this.conversationHistoryService.setCurrentUser('anonymous');
      }
    });

    // Also register a callback for when AuthService notifies user change
    this.authService.onUserChange((userId: string) => {
      console.log('🔄 User changed callback triggered:', userId);
      this.conversationHistoryService.setCurrentUser(userId);
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
          // Get appropriate audio constraints for the platform
          const audioConstraints = this.getAudioConstraints();
          console.log('🎤 Audio constraints:', audioConstraints);

          this.stream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints,
          });
          console.log('✅ Microphone access granted, stream:', this.stream);

          // Log stream details for debugging
          if (this.stream) {
            const audioTracks = this.stream.getAudioTracks();
            console.log('🎤 Audio tracks:', audioTracks.length);
            audioTracks.forEach((track, index) => {
              console.log(`🎤 Track ${index}:`, {
                label: track.label,
                enabled: track.enabled,
                muted: track.muted,
                readyState: track.readyState,
                settings: track.getSettings(),
                constraints: track.getConstraints(),
              });
            });
          }
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

          // Check for speech activity - if we have audio data, assume speech is happening
          if (event.data.size > 0) {
            this.detectSpeechActivity();
          }
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
        this.mediaRecorder.start(500); // Start recording, collect data every 500ms for faster processing
        this.isRecording = true;
        this.startPeriodicRefresh();
        this.startIdleTimeout();

        // Initialize speech activity detection
        this.lastSpeechTime = Date.now();
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

    // Stop speech activity detection
    this.stopSpeechActivityDetection();

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
      // No speech detected - just clean up without alert
      console.log(
        'No speech detected when stopping recording - cleaning up silently'
      );
      this.hideAllSpinners();
      this.cleanupBuffers(); // Clean up buffers when no speech detected
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
    // Extended timeout - only stop if no speech detected for a long time
    const idleDuration = this.isMobile ? 120000 : 180000; // 2 minutes for mobile, 3 minutes for desktop
    this.idleTimeout = setTimeout(() => {
      console.log('Extended idle timeout reached. Auto-stopping recording.');
      this.stopRecording();
    }, idleDuration);
  }

  private stopIdleTimeout() {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
      this.idleTimeout = undefined;
    }
  }

  // Speech activity detection - extends recording while person is speaking
  private detectSpeechActivity() {
    this.lastSpeechTime = Date.now();

    // Clear any existing speech activity timeout
    if (this.speechActivityTimeout) {
      clearTimeout(this.speechActivityTimeout);
    }

    // Set a new timeout to stop recording after silence
    this.speechActivityTimeout = setTimeout(() => {
      const silenceDuration = Date.now() - this.lastSpeechTime;
      console.log(
        `🔇 Silence detected for ${silenceDuration}ms, stopping recording...`
      );
      this.stopRecording();
    }, this.SPEECH_SILENCE_THRESHOLD);
  }

  private stopSpeechActivityDetection() {
    if (this.speechActivityTimeout) {
      clearTimeout(this.speechActivityTimeout);
      this.speechActivityTimeout = undefined;
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

      // Debug: Check what we received
      console.log('📦 Transcription result:', transcriptionResult);
      console.log('📦 Warning field:', (transcriptionResult as any).warning);
      console.log('📦 WrongLanguage field:', transcriptionResult.wrongLanguage);

      // Check for language mismatch warning (show toast but continue)
      if ((transcriptionResult as any).warning) {
        console.warn(
          '⚠️ Language warning:',
          (transcriptionResult as any).warning
        );
        // Show auto-dismissing toast (2 seconds) but CONTINUE translation
        // Toast removed for performance
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

        this.showTranslationError(
          'Could not transcribe speech. Please try speaking again.'
        );
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
        this.showTranslationError(userMessage);
        return;
      } else {
        console.log(
          '✅ No wrong language detection - proceeding with normal transcription'
        );
      }

      // Frontend language detection removed for performance

      // Deadlock detection - check for system errors that could cause deadlocks
      if (this.isDeadlockTranslation(transcribedText)) {
        console.warn('🚫 Deadlock translation detected, stopping process');
        this.hideAllSpinners();
        this.cleanupBuffers();
        this.showTranslationError(
          'Translation deadlock detected. Please try again.'
        );
        return;
      }

      // Language filtering - REMOVED blocking, now just warning via toast
      // The backend AI detection will show a warning toast but still translate
      console.log(
        '✅ Proceeding with translation regardless of language warning'
      );

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
          this.selectedUserLanguage,
          this.selectedUserLanguage,
          this.selectedPartnerLanguage
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
          this.selectedPartnerLanguage,
          this.selectedUserLanguage,
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
        this.showTranslationError(
          'Translation failed. Please try speaking again.'
        );
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
        this.showTranslationError(
          'Failed to generate audio for translation. Please try again.'
        );
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

      // Use the transcribed text directly without language detection
      const finalTranscribedText = transcribedText;

      const historyEntry: Omit<ConversationHistoryEntry, 'id' | 'timestamp'> = {
        originalText: finalTranscribedText,
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
        original: finalTranscribedText,
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
      this.showTranslationError(
        'An error occurred during processing. Please try again.'
      );
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
          this.showTranslationError(
            'Translation failed. Please try speaking again.'
          );
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
          this.showTranslationError(
            'Failed to generate audio for translation. Please try again.'
          );
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
          this.showTranslationError(
            'Translation failed. Please try speaking again.'
          );
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
          this.showTranslationError(
            'Failed to generate audio for translation. Please try again.'
          );
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
      this.showTranslationError(
        'An error occurred during processing. Please try again.'
      );
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
      this.showTranslationError(
        'Text exceeds 200 words limit. Please shorten your message.'
      );
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

      // Use the same translation flow as speech with language context
      const translation = await this.svc.translate(
        text,
        this.selectedPartnerLanguage,
        this.selectedUserLanguage,
        this.selectedUserLanguage,
        this.selectedPartnerLanguage
      );

      // Check if translation is empty or invalid
      if (!translation || translation.trim().length === 0) {
        console.warn('Empty translation received from API');
        this.hideAllSpinners();
        // this.showToast('Translation failed. Please try again.');
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
        this.showTranslationError(
          'Failed to generate audio for translation. Please try again.'
        );
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
      this.showTranslationError('Failed to translate text. Please try again.');
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
      this.showTranslationError(
        'Text exceeds 200 words limit. Please shorten your message.'
      );
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

      // Use the same translation flow as speech with language context
      const translation = await this.svc.translate(
        text,
        this.selectedUserLanguage,
        this.selectedPartnerLanguage,
        this.selectedUserLanguage,
        this.selectedPartnerLanguage
      );

      // Check if translation is empty or invalid
      if (!translation || translation.trim().length === 0) {
        console.warn('Empty translation received from API');
        this.hideAllSpinners();
        // this.showToast('Translation failed. Please try again.');
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
        this.showTranslationError(
          'Failed to generate audio for translation. Please try again.'
        );
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
      this.showTranslationError('Failed to translate text. Please try again.');
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
      this.showTranslationError('Unable to play audio: ' + error.message);
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
      en: `You are an English speech-to-text system. You MUST transcribe ONLY English speech using ONLY Latin script (a-z A-Z).

CRITICAL RULES:
1. ONLY use Latin letters: a b c d e f g h i j k l m n o p q r s t u v w x y z
2. Common English words: "hello", "thank you", "good", "how", "what", "cat", "dog", "yes", "no"
3. If you hear ANY non-English speech (Kyrgyz, Korean, Chinese, etc.), return "WRONG_LANGUAGE_DETECTED: Please speak in English only"
4. NEVER transcribe Cyrillic, Hangul, or Chinese characters

Examples of CORRECT English transcription:
- "hello world" → "hello world"
- "thank you very much" → "thank you very much"
- "cat-cat, bitch-cat" → "cat-cat, bitch-cat"

Examples of WRONG input that should trigger error:
- "салам" → "WRONG_LANGUAGE_DETECTED: Please speak in English only"
- "안녕하세요" → "WRONG_LANGUAGE_DETECTED: Please speak in English only"
- "你好" → "WRONG_LANGUAGE_DETECTED: Please speak in English only"

If you cannot transcribe in pure English, return "WRONG_LANGUAGE_DETECTED: Please speak in English only"`,
      ko: `Transcribe Korean speech (한국어) accurately using ONLY Hangul script. Common words: "안녕하세요" (hello), "감사합니다" (thank you), "좋다" (good), "어떻게" (how), "무엇" (what). NEVER mix scripts - use only Hangul letters. If not Korean, return "WRONG_LANGUAGE_DETECTED: 한국어로만 말해주세요".`,
      zh: `Transcribe Chinese speech (中文) accurately. Common words: "你好" (hello), "谢谢" (thank you), "好" (good), "怎么" (how), "什么" (what). If not Chinese, return "WRONG_LANGUAGE_DETECTED: 请只说中文".`,
      ky: `You are a Kyrgyz speech-to-text system. You MUST transcribe ONLY Kyrgyz speech using ONLY Cyrillic script (а-яёА-ЯЁ).

CRITICAL RULES:
1. NEVER use Korean Hangul (ㄱ-ㅎㅏ-ㅣ가-힣), Chinese (一-龯), or Latin characters
2. ONLY use Cyrillic letters: а б в г д е ё ж з и й к л м н о п р с т у ф х ц ч ш щ ъ ы ь э ю я
3. Common Kyrgyz words: "мен" (I), "сен" (you), "атыңыз" (your name), "ким" (who), "салам" (hello), "рахмат" (thanks)
4. If you hear ANY non-Kyrgyz speech (English, Korean, Chinese, etc.), return "WRONG_LANGUAGE_DETECTED: Кыргызча гана сүйлөңүз"
5. If unsure about spelling, use standard Kyrgyz Cyrillic spelling
6. NEVER mix scripts - ONLY Cyrillic allowed
7. NEVER transcribe English words like "cat", "bitch", "hello", "thank you" - these are NOT Kyrgyz

Examples of CORRECT Kyrgyz transcription:
- "мен атыңыз ким" (What is your name?)
- "салам" (Hello)
- "рахмат" (Thank you)

Examples of WRONG input that should trigger error:
- "cat-cat, bitch-cat" → "WRONG_LANGUAGE_DETECTED: Кыргызча гана сүйлөңүз"
- "hello world" → "WRONG_LANGUAGE_DETECTED: Кыргызча гана сүйлөңүз"
- "안녕하세요" → "WRONG_LANGUAGE_DETECTED: Кыргызча гана сүйлөңүз"

If you cannot transcribe in pure Cyrillic Kyrgyz, return "WRONG_LANGUAGE_DETECTED: Кыргызча гана сүйлөңүз"`,
      ru: `Transcribe Russian speech (Русский) accurately. Common words: "привет" (hello), "спасибо" (thank you), "хорошо" (good), "как" (how), "что" (what). If not Russian, return "WRONG_LANGUAGE_DETECTED: Говорите только по-русски".`,
      kk: `Transcribe Kazakh speech (Қазақша) accurately. Common words: "сәлем" (hello), "рахмет" (thank you), "жақсы" (good), "қалай" (how), "не" (what). If not Kazakh, return "WRONG_LANGUAGE_DETECTED: Қазақша ғана сөйлеңіз".`,
      tg: `Transcribe Tajik speech (Тоҷикӣ) accurately. Common words: "салом" (hello), "ташаккур" (thank you), "хуб" (good), "чӣ тавр" (how), "чӣ" (what). If not Tajik, return "WRONG_LANGUAGE_DETECTED: Тоҷикӣ ғана гап занед".`,
      tk: `Transcribe Turkmen speech (Türkmençe) accurately. Common words: "salam" (hello), "sag bol" (thank you), "gowy" (good), "nähili" (how), "näme" (what). If not Turkmen, return "WRONG_LANGUAGE_DETECTED: Türkmençe ýalňyz gürleň".`,
      uz: `Transcribe Uzbek speech (O'zbekcha) accurately. Common words: "salom" (hello), "rahmat" (thank you), "yaxshi" (good), "qanday" (how), "nima" (what). If not Uzbek, return "WRONG_LANGUAGE_DETECTED: O'zbekcha gapiring".`,
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

  // Frontend language detection methods removed for performance

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
      this.showTranslationError('No audio available for this conversation');
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
      return new Blob([byteArray], { type: 'audio/wav' });
    } catch (error) {
      console.error('Error converting base64 to blob:', error);
      throw new Error('Invalid base64 data');
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

  private isDeadlockTranslation(text: string): boolean {
    const lowerText = text.toLowerCase().trim();

    // Check for various deadlock patterns
    const deadlockPatterns = [
      // Empty or invalid responses
      text.length === 0,
      text.trim().length === 0,
      text === 'null',
      text === 'undefined',
      text === 'error',
      text === 'failed',
      text === 'timeout',
      text === 'processing',
      // Error patterns
      text.includes('processing') && text.includes('error'),
      text.includes('translation') && text.includes('failed'),
      text.includes('system') && text.includes('error'),
      text.includes('network') && text.includes('error'),
      text.includes('server') && text.includes('error'),
      // Very long error messages
      text.length > 1000 && lowerText.includes('error'),
      // Repeated text patterns
      this.isRepeatedText(text),
    ];

    return deadlockPatterns.some((pattern) => pattern);
  }

  private isRepeatedText(text: string): boolean {
    if (text.length < 10) return false;

    // Check for repeated words or phrases
    const words = text.split(' ');
    if (words.length < 3) return false;

    // Check if more than 70% of words are the same
    const wordCounts = words.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const maxCount = Math.max(...Object.values(wordCounts));
    const repetitionRatio = maxCount / words.length;

    return repetitionRatio > 0.7;
  }

  private filterLanguageText(text: string, targetLanguage: string): string {
    // For now, we'll use a simple approach and let the system prompt handle language filtering
    // The system prompt should already be configured to only transcribe the target language
    // This method can be enhanced later with more sophisticated filtering

    switch (targetLanguage) {
      case 'en':
        // Allow English characters, numbers, and common punctuation
        if (/^[a-zA-Z0-9\s.,!?\-'"]+$/.test(text)) {
          return text;
        }
        break;
      case 'ko':
        // Allow Korean characters, English, numbers, and common punctuation
        if (/^[가-힣a-zA-Z0-9\s.,!?\-'"]+$/.test(text)) {
          return text;
        }
        break;
      case 'zh':
        // Allow Chinese characters, English, numbers, and common punctuation
        if (/^[\u4e00-\u9fff\u3400-\u4dbfa-zA-Z0-9\s.,!?\-'"]+$/.test(text)) {
          return text;
        }
        break;
      case 'ky':
      case 'ru':
      case 'kk':
      case 'tg':
        // Allow Cyrillic characters, English, numbers, and common punctuation
        if (/^[а-яА-Яa-zA-Z0-9\s.,!?\-'"]+$/.test(text)) {
          return text;
        }
        break;
      case 'tk':
      case 'uz':
        // Allow Latin characters, numbers, and common punctuation
        if (/^[a-zA-Z0-9\s.,!?\-'"]+$/.test(text)) {
          return text;
        }
        break;
    }

    // If filtering fails, return original text
    return text;
  }

  getLanguageName(languageCode: string): string {
    const languageNames: { [key: string]: string } = {
      en: 'English',
      ko: 'Korean (한국어)',
      zh: 'Chinese (中文)',
      ky: 'Kyrgyz (Кыргызча)',
      ru: 'Russian (Русский)',
      kk: 'Kazakh (Қазақша)',
      tg: 'Tajik (Тоҷикӣ)',
      tk: 'Turkmen (Türkmençe)',
      uz: "Uzbek (O'zbekcha)",
    };
    return languageNames[languageCode] || languageCode;
  }

  // Simple error display method (replaces toast for performance)
  private showTranslationError(message: string) {
    console.error('Translation Error:', message);
    // Simple alert for critical errors only
    if (
      message.includes('Translation failed') ||
      message.includes('Could not transcribe')
    ) {
      alert(message);
    }
  }
}
