import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

// Declare Capacitor types for TypeScript
declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform(): boolean;
    };
  }
}

@Injectable({ providedIn: 'root' })
export class TranslatorService {
  private base: string;
  private translationCache = new Map<string, string>();
  private readonly CACHE_SIZE_LIMIT = 1000; // Limit cache size

  constructor() {
    this.base = this.getBaseUrl();
  }

  getCurrentBaseUrl(): string {
    // Always re-detect the environment
    return this.getBaseUrl();
  }

  private getBaseUrl(): string {
    // Use environment configuration
    const apiUrl = environment.apiUrl;
    console.log('🌐 Using API URL from environment:', apiUrl);
    return apiUrl;
  }
  private isPlayingAudio = false;

  async primeLanguage(
    language: 'ky' | 'en' | 'ko' | 'zh' | 'ru' | 'kk' | 'tg' | 'tk' | 'uz'
  ) {
    try {
      const r = await fetch(`${this.base}/api/prime-language`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      });
      if (!r.ok) throw new Error(await r.text());
      return await r.json();
    } catch (error) {
      console.warn('Language priming failed:', error);
      // Don't throw error, just log it as priming is optional
      return { success: false };
    }
  }

  async transcribe(
    blob: Blob,
    translateToEnglish: boolean,
    language?: string,
    systemPrompt?: string
  ) {
    console.log('🎤 Starting transcription...');
    console.log('📊 Blob size:', blob.size, 'bytes');
    const currentBase = this.getCurrentBaseUrl();
    console.log('🌐 Base URL:', currentBase);
    console.log('🔄 Translate to English:', translateToEnglish);
    console.log('🗣️ Language:', language);

    // Test basic connectivity first
    console.log('🧪 Testing basic connectivity...');
    try {
      const testUrl = `${currentBase}/health`;
      console.log('🔍 Testing health endpoint:', testUrl);
      const testResponse = await fetch(testUrl, { method: 'GET' });
      console.log('🏥 Health check response:', {
        status: testResponse.status,
        ok: testResponse.ok,
        statusText: testResponse.statusText,
      });
      if (testResponse.ok) {
        const healthData = await testResponse.json();
        console.log('✅ Health check data:', healthData);
      } else {
        console.error(
          '❌ Health check failed with status:',
          testResponse.status
        );
      }
    } catch (healthError) {
      console.error('❌ Health check failed:', healthError);
    }

    const fd = new FormData();

    // Determine the correct file extension based on blob type
    let filename = 'audio.webm'; // default
    if (blob.type.includes('mp4')) filename = 'audio.mp4';
    else if (blob.type.includes('wav')) filename = 'audio.wav';
    else if (blob.type.includes('m4a')) filename = 'audio.m4a';
    else if (blob.type.includes('mp3')) filename = 'audio.mp3';
    else if (blob.type.includes('ogg')) filename = 'audio.ogg';
    else if (blob.type.includes('webm')) filename = 'audio.webm';
    else if (blob.type.includes('flac')) filename = 'audio.flac';
    else if (blob.type.includes('mpeg')) filename = 'audio.mpeg';
    else if (blob.type.includes('mpga')) filename = 'audio.mpga';
    else if (blob.type.includes('oga')) filename = 'audio.oga';

    console.log('📁 Using filename:', filename);
    console.log('📄 Blob type:', blob.type);

    fd.append('audio', blob, filename);
    fd.append('translateToEnglish', String(translateToEnglish));
    if (language) {
      fd.append('language', language);
    }
    if (systemPrompt) {
      fd.append('systemPrompt', systemPrompt);
      console.log('📝 System prompt added:', systemPrompt);
      console.log(
        '🔍 System prompt contains WRONG_LANGUAGE_DETECTED:',
        systemPrompt.includes('WRONG_LANGUAGE_DETECTED')
      );
    } else {
      console.warn('⚠️ No system prompt provided!');
    }

    const url = `${currentBase}/api/transcribe`;
    console.log('🚀 Making request to:', url);

    try {
      const r = await fetch(url, {
        method: 'POST',
        body: fd,
      });

      console.log('📡 Response status:', r.status);
      console.log('📡 Response ok:', r.ok);

      if (!r.ok) {
        const errorText = await r.text();
        console.error('❌ API Error:', errorText);
        throw new Error(errorText);
      }

      const result = await r.json();
      console.log('✅ Transcription result:', result);
      console.log(
        '🔍 Result text contains WRONG_LANGUAGE_DETECTED:',
        result.text?.includes('WRONG_LANGUAGE_DETECTED')
      );

      return {
        text: result.text as string,
        confidence: result.confidence as number,
        wrongLanguage: result.wrongLanguage as boolean,
        message: result.message as string,
        warning: result.warning as string,
      };
    } catch (error) {
      console.error('💥 Transcription error:', error);
      throw error;
    }
  }

  async translate(
    text: string,
    target: 'ky' | 'en' | 'ko' | 'zh' | 'ru' | 'kk' | 'tg' | 'tk' | 'uz',
    sourceLanguage?: string,
    userLanguage?: string,
    partnerLanguage?: string
  ) {
    console.log('🔄 Starting translation...');
    console.log('📝 Text to translate:', text);
    console.log('🎯 Target language:', target);
    console.log('🔤 Source language:', sourceLanguage);

    // Check cache first for performance
    const cacheKey = `${text}|${target}|${sourceLanguage}`;
    if (this.translationCache.has(cacheKey)) {
      console.log('⚡ Using cached translation');
      return this.translationCache.get(cacheKey)!;
    }

    // Get current base URL dynamically
    const currentBase = this.getCurrentBaseUrl();
    console.log('🌐 Base URL:', currentBase);
    console.log('🔍 Environment check:');
    console.log('  - window.Capacitor exists:', !!window.Capacitor);
    console.log(
      '  - window.Capacitor.isNativePlatform():',
      window.Capacitor?.isNativePlatform?.()
    );
    console.log('  - window.location.hostname:', window.location.hostname);
    console.log('  - window.navigator.userAgent:', window.navigator.userAgent);

    // Test API connectivity first
    console.log('🧪 Testing API connectivity...');
    try {
      const testUrl = `${currentBase}/health`;
      console.log('🔍 Testing health endpoint:', testUrl);
      const testResponse = await fetch(testUrl, { method: 'GET' });
      console.log('🏥 Health check response:', {
        status: testResponse.status,
        ok: testResponse.ok,
        statusText: testResponse.statusText,
      });
      if (testResponse.ok) {
        const healthData = await testResponse.json();
        console.log('✅ Health check data:', healthData);
      }
    } catch (healthError) {
      console.error('❌ Health check failed:', healthError);
      console.error('❌ This indicates a network connectivity issue');
    }
    // Filter out English speech when translating to English (Kyrgyz lane)
    if (target === 'en') {
      const englishPatterns = [
        /\b(hello|hi|hey|good|morning|afternoon|evening|night|yes|no|please|thank|you|welcome|sorry|excuse|me|how|are|what|where|when|why|who|can|could|would|should|will|shall|have|has|had|do|does|did|am|is|are|was|were|be|been|being|the|a|an|and|or|but|so|if|then|because|although|while|during|before|after|until|since|for|with|without|by|from|to|in|on|at|up|down|out|off|over|under|through|across|around|between|among|against|toward|towards|into|onto|upon|within|beyond|behind|below|above|beneath|beside|besides|except|including|regarding|concerning|considering|given|provided|unless|whether|either|neither|both|all|some|any|every|each|other|another|such|same|different|similar|like|unlike|as|than|more|most|less|least|very|quite|rather|too|enough|so|such|much|many|few|little|several|all|both|half|double|triple|single|multiple|various|several|numerous|countless|infinite|limited|unlimited|restricted|unrestricted|free|bound|tied|loose|tight|loose|firm|soft|hard|easy|difficult|simple|complex|basic|advanced|beginner|expert|professional|amateur|skilled|unskilled|experienced|inexperienced|qualified|unqualified|certified|uncertified|licensed|unlicensed|authorized|unauthorized|official|unofficial|formal|informal|public|private|personal|professional|business|commercial|industrial|residential|urban|rural|domestic|international|local|global|national|regional|state|federal|municipal|county|city|town|village|neighborhood|community|society|culture|tradition|custom|habit|routine|practice|method|technique|approach|strategy|tactic|plan|schedule|agenda|program|project|task|job|work|career|profession|occupation|employment|business|company|organization|institution|agency|department|division|section|unit|team|group|committee|board|council|government|administration|management|leadership|supervision|direction|guidance|instruction|education|training|learning|teaching|studying|research|development|improvement|progress|advancement|growth|expansion|increase|decrease|reduction|cut|save|spend|invest|earn|make|lose|win|fail|succeed|achieve|accomplish|complete|finish|start|begin|continue|stop|end|pause|resume|delay|hurry|rush|slow|fast|quick|slow|early|late|on|time|punctual|tardy|available|unavailable|busy|free|occupied|vacant|empty|full|complete|incomplete|finished|unfinished|done|undone|ready|unready|prepared|unprepared|organized|disorganized|clean|dirty|neat|messy|tidy|untidy|orderly|disorderly|systematic|random|logical|illogical|reasonable|unreasonable|rational|irrational|sensible|nonsensical|practical|impractical|useful|useless|helpful|unhelpful|beneficial|harmful|safe|dangerous|secure|insecure|stable|unstable|steady|unsteady|firm|weak|strong|powerful|powerless|effective|ineffective|efficient|inefficient|productive|unproductive|successful|unsuccessful|profitable|unprofitable|valuable|worthless|important|unimportant|significant|insignificant|major|minor|main|secondary|primary|secondary|first|last|next|previous|current|past|future|present|recent|old|new|young|mature|immature|adult|child|baby|infant|teenager|elderly|senior|junior|beginner|expert|novice|veteran|fresh|stale|hot|cold|warm|cool|dry|wet|moist|damp|humid|arid|bright|dark|light|heavy|thick|thin|wide|narrow|broad|deep|shallow|high|low|tall|short|long|brief|big|small|large|tiny|huge|enormous|massive|giant|mini|micro|macro|super|mega|ultra|hyper|extra|special|unique|different|same|similar|identical|exact|precise|accurate|wrong|incorrect|right|correct|true|false|real|fake|genuine|authentic|original|copy|duplicate|single|double|triple|quadruple|multiple|many|few|several|some|all|none|nothing|everything|something|anything|someone|anyone|everyone|nobody|somebody|anybody|everybody|here|there|where|when|why|how|what|which|who|whom|whose|this|that|these|those|my|your|his|her|its|our|their|mine|yours|hers|ours|theirs|me|you|him|her|it|us|them|myself|yourself|himself|herself|itself|ourselves|yourselves|themselves|i|we|he|she|they|am|is|are|was|were|be|been|being|have|has|had|having|do|does|did|doing|will|would|could|should|may|might|must|can|cannot|can't|won't|wouldn't|couldn't|shouldn't|mayn't|mightn't|mustn't|shan't|ain't|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't|don't|doesn't|didn't)\b/gi,
      ];

      const isEnglish = englishPatterns.some((pattern) => pattern.test(text));
      if (isEnglish) {
        console.log(
          'Client-side filtered out English speech in Kyrgyz lane:',
          text
        );
        return ''; // Return empty string instead of translating
      }
    }

    // Create translation system prompt with language selection context
    const translationSystemPrompt = this.getTranslationSystemPrompt(
      target,
      sourceLanguage,
      userLanguage,
      partnerLanguage
    );
    console.log('📝 Translation system prompt:', translationSystemPrompt);

    const url = `${currentBase}/api/translate`;
    console.log('🚀 Making translation request to:', url);

    const requestBody = {
      text,
      target,
      systemPrompt: translationSystemPrompt,
    };
    console.log('📤 Request body:', JSON.stringify(requestBody));

    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      console.log('📡 Translation response status:', r.status);
      console.log('📡 Translation response ok:', r.ok);

      if (!r.ok) {
        const errorText = await r.text();
        console.error('❌ Translation API Error:', errorText);
        throw new Error(errorText);
      }

      const result = await r.json();
      console.log('✅ Translation result:', result);

      const translation = result.text as string;

      // Cache the translation for future use
      this.cacheTranslation(cacheKey, translation);

      return translation;
    } catch (error) {
      console.error('💥 Translation fetch error:', error);
      console.error('💥 Error details:', {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
        type: typeof error,
      });

      // Check if it's a network error
      if (
        error instanceof TypeError &&
        error.message.includes('Failed to fetch')
      ) {
        console.error('🌐 Network error detected - possible causes:');
        console.error('  - No internet connection');
        console.error('  - API server is down');
        console.error('  - CORS issues');
        console.error('  - Android emulator network configuration');
        console.error('  - URL:', url);
      }

      throw error;
    }
  }

  async tts(
    text: string,
    speed: number = 1.0,
    voice: string = 'alloy'
  ): Promise<{ audioUrl: string; audioData: string } | null> {
    // Filter out unwanted TTS responses on client side too
    const filteredText = text.toLowerCase().trim();
    if (
      filteredText.includes('thank you for watching') ||
      filteredText.includes('thank you for watching!') ||
      filteredText.includes('thanks for watching') ||
      filteredText.includes('thanks for watching!') ||
      filteredText === 'thank you for watching' ||
      filteredText === 'thanks for watching'
    ) {
      console.log('Client-side filtered out unwanted TTS response:', text);
      return null;
    }

    const r = await fetch(`${this.base}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, format: 'mp3', voice }),
    });
    if (!r.ok) {
      const errorText = await r.text();
      // Don't throw error for filtered responses
      if (errorText.includes('Filtered out unwanted TTS response')) {
        console.log('Server-side filtered out unwanted TTS response:', text);
        return null;
      }
      throw new Error(errorText);
    }

    // Real TTS mode - return both audio URL and base64 data
    const blob = await r.blob();
    const audioUrl = URL.createObjectURL(blob);

    // Convert to base64 immediately while blob is still valid
    const audioData = await this.blobToBase64(blob);

    // Don't auto-play here - let the app component handle audio playback
    // this.playAudio(audioUrl, speed);

    return { audioUrl, audioData };
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  private currentAudio?: HTMLAudioElement;

  private playAudio(audioUrl: string, speed: number = 1.0) {
    // Stop any currently playing audio
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
    }

    this.isPlayingAudio = true;
    this.currentAudio = new Audio(audioUrl);
    this.currentAudio.volume = 0.8; // Set volume to 80%
    this.currentAudio.playbackRate = speed; // Set playback speed

    // Play the audio
    this.currentAudio.play().catch((error) => {
      console.warn('Auto-play failed:', error);
      this.isPlayingAudio = false;
      // If auto-play fails, we can still return the URL for manual play
    });

    // Clean up the URL after playing to free memory
    this.currentAudio.addEventListener('ended', () => {
      this.isPlayingAudio = false;
      this.currentAudio = undefined;
      URL.revokeObjectURL(audioUrl);
    });

    this.currentAudio.addEventListener('error', () => {
      this.isPlayingAudio = false;
      this.currentAudio = undefined;
    });
  }

  get playingAudio() {
    return this.isPlayingAudio;
  }

  // Cache management methods
  private cacheTranslation(key: string, translation: string): void {
    // Limit cache size to prevent memory issues
    if (this.translationCache.size >= this.CACHE_SIZE_LIMIT) {
      // Remove oldest entries (Map maintains insertion order)
      const firstKey = this.translationCache.keys().next().value;
      if (firstKey) {
        this.translationCache.delete(firstKey);
      }
    }

    this.translationCache.set(key, translation);
    console.log(
      `💾 Cached translation. Cache size: ${this.translationCache.size}`
    );
  }

  // Clear cache if needed
  clearTranslationCache(): void {
    this.translationCache.clear();
    console.log('🗑️ Translation cache cleared');
  }

  /**
   * Get language-specific system prompt for translation with language selection context
   */
  private getTranslationSystemPrompt(
    targetLanguage: string,
    sourceLanguage?: string,
    userLanguage?: string,
    partnerLanguage?: string
  ): string {
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

    const targetName = languageNames[targetLanguage] || targetLanguage;
    const sourceName = sourceLanguage
      ? languageNames[sourceLanguage] || sourceLanguage
      : 'the source language';

    // Build language selection context
    let languageContext = '';
    if (userLanguage && partnerLanguage) {
      const userLangName = languageNames[userLanguage] || userLanguage;
      const partnerLangName = languageNames[partnerLanguage] || partnerLanguage;
      languageContext = `

🎯 LANGUAGE SELECTION CONTEXT:
- User speaks: ${userLangName}
- Partner speaks: ${partnerLangName}
- Current translation direction: ${sourceName} → ${targetName}
- This is a conversation between a ${userLangName} speaker and a ${partnerLangName} speaker
- The translation should be natural and appropriate for this specific language pair`;
    }

    // Add specific instructions for Kyrgyz and Kazakh to prevent confusion
    let specificInstructions = '';
    if (targetLanguage === 'ky') {
      specificInstructions = `

🚨 CRITICAL FOR KYRGYZ TRANSLATION: 🚨
- This is KYRGYZ (Кыргызча), NOT Kazakh (Қазақша)
- Use ONLY Kyrgyz-specific vocabulary and grammar patterns
- Common Kyrgyz words: "салам" (hello), "рахмат" (thank you), "жакшы" (good), "кантип" (how), "эмне" (what)
- Kyrgyz verb forms: "айтамын" (I will say), "уктаймын" (I will sleep), "барам" (I go), "келем" (I come)
- Kyrgyz uses "ы" and "ү" sounds more frequently than Kazakh
- Kyrgyz is spoken in Kyrgyzstan, NOT Kazakhstan
- Kyrgyz has different vowel harmony than Kazakh
- FORBIDDEN: Do NOT use any Kazakh words, patterns, or vocabulary
- If the source text appears to be Kazakh, translate it as if it were Kyrgyz
- Always use Kyrgyz spelling conventions, not Kazakh ones
- Pay attention to Kyrgyz verb conjugations and tenses`;
    } else if (targetLanguage === 'kk') {
      specificInstructions = `

🚨 CRITICAL FOR KAZAKH TRANSLATION: 🚨
- This is KAZAKH (Қазақша), NOT Kyrgyz (Кыргызча)
- Use Kazakh-specific vocabulary and grammar patterns
- Common Kazakh words: "сәлем" (hello), "рахмет" (thank you), "жақсы" (good), "қалай" (how), "не" (what)
- Kazakh uses "қ" and "ғ" sounds more frequently than Kyrgyz
- Kazakh is spoken in Kazakhstan, NOT Kyrgyzstan
- DO NOT use Kyrgyz words or patterns
- Pay attention to Kazakh verb conjugations and tenses`;
    }

    // Add context-specific instructions based on language pair
    let pairSpecificInstructions = '';
    if (userLanguage && partnerLanguage) {
      if (
        (userLanguage === 'en' && partnerLanguage === 'ky') ||
        (userLanguage === 'ky' && partnerLanguage === 'en')
      ) {
        pairSpecificInstructions = `

💬 ENGLISH-KYRGYZ CONVERSATION CONTEXT:
- This is a conversation between English and Kyrgyz speakers
- Use conversational, friendly tone appropriate for real-time communication
- Consider cultural context: English speaker may be unfamiliar with Kyrgyz culture
- Kyrgyz speaker may be unfamiliar with English cultural references
- Use clear, simple language that's easy to understand in real-time`;
      } else if (
        (userLanguage === 'en' && partnerLanguage === 'kk') ||
        (userLanguage === 'kk' && partnerLanguage === 'en')
      ) {
        pairSpecificInstructions = `

💬 ENGLISH-KAZAKH CONVERSATION CONTEXT:
- This is a conversation between English and Kazakh speakers
- Use conversational, friendly tone appropriate for real-time communication
- Consider cultural context: English speaker may be unfamiliar with Kazakh culture
- Kazakh speaker may be unfamiliar with English cultural references
- Use clear, simple language that's easy to understand in real-time`;
      } else if (
        (userLanguage === 'en' && partnerLanguage === 'ko') ||
        (userLanguage === 'ko' && partnerLanguage === 'en')
      ) {
        pairSpecificInstructions = `

💬 ENGLISH-KOREAN CONVERSATION CONTEXT:
- This is a conversation between English and Korean speakers
- Use conversational, friendly tone appropriate for real-time communication
- Consider cultural context: English speaker may be unfamiliar with Korean culture
- Korean speaker may be unfamiliar with English cultural references
- Use clear, simple language that's easy to understand in real-time`;
      } else if (
        (userLanguage === 'en' && partnerLanguage === 'zh') ||
        (userLanguage === 'zh' && partnerLanguage === 'en')
      ) {
        pairSpecificInstructions = `

💬 ENGLISH-CHINESE CONVERSATION CONTEXT:
- This is a conversation between English and Chinese speakers
- Use conversational, friendly tone appropriate for real-time communication
- Consider cultural context: English speaker may be unfamiliar with Chinese culture
- Chinese speaker may be unfamiliar with English cultural references
- Use clear, simple language that's easy to understand in real-time`;
      } else if (
        (userLanguage === 'en' && partnerLanguage === 'ru') ||
        (userLanguage === 'ru' && partnerLanguage === 'en')
      ) {
        pairSpecificInstructions = `

💬 ENGLISH-RUSSIAN CONVERSATION CONTEXT:
- This is a conversation between English and Russian speakers
- Use conversational, friendly tone appropriate for real-time communication
- Consider cultural context: English speaker may be unfamiliar with Russian culture
- Russian speaker may be unfamiliar with English cultural references
- Use clear, simple language that's easy to understand in real-time`;
      }
    }

    return `Translate from ${sourceName} to ${targetName}.${languageContext}${specificInstructions}${pairSpecificInstructions}

Rules: Only translate to ${targetName}. Use natural conversation style. Return only the translation.`;
  }
}
