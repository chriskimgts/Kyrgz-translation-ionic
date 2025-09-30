import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface TranslationKeys {
  // Navigation
  languages: string;
  voiceType: string;
  account: string;
  profile: string;
  settings: string;
  history: string;
  login: string;
  register: string;
  logout: string;

  // Language Selection
  youSpeak: string;
  partnerSpeaks: string;
  speakingSpeed: string;
  slow: string;
  fast: string;

  // Main App
  start: string;
  end: string;
  clear: string;
  translate: string;
  typeMessage: string;
  typePartnerMessage: string;
  maxWords: string;
  characters: string;

  // Conversation
  youSpeakLabel: string;
  partnerSpeaksLabel: string;
  hears: string;

  // History Modal
  conversationHistory: string;
  clearAll: string;
  play: string;
  delete: string;
  confidence: string;
  recorded: string;

  // Status Messages
  processing: string;
  recording: string;
  translating: string;
  error: string;
  success: string;
}

@Injectable({
  providedIn: 'root',
})
export class TranslationService {
  private currentLanguage = new BehaviorSubject<string>('en');
  public currentLanguage$ = this.currentLanguage.asObservable();

  private translations: { [key: string]: TranslationKeys } = {
    en: {
      // Navigation
      languages: 'Languages',
      voiceType: 'Voice Type',
      account: 'Account',
      profile: 'Profile',
      settings: 'Settings',
      history: 'History',
      login: 'Login',
      register: 'Register',
      logout: 'Logout',

      // Language Selection
      youSpeak: 'You speak:',
      partnerSpeaks: 'Partner speaks:',
      speakingSpeed: 'Speaking Speed:',
      slow: 'Slow',
      fast: 'Fast',

      // Main App
      start: 'Start',
      end: 'End',
      clear: 'Clear',
      translate: 'Translate',
      typeMessage: 'Type your message here...',
      typePartnerMessage: "Type partner's message here...",
      maxWords: 'max 200 words',
      characters: 'characters',

      // Conversation
      youSpeakLabel: 'You speak',
      partnerSpeaksLabel: 'Partner speaks',
      hears: 'hears',

      // History Modal
      conversationHistory: 'Conversation History',
      clearAll: 'Clear All',
      play: 'Play',
      delete: 'Delete',
      confidence: 'Confidence',
      recorded: 'Recorded',

      // Status Messages
      processing: 'Processing...',
      recording: 'Recording...',
      translating: 'Translating...',
      error: 'Error',
      success: 'Success',
    },

    ko: {
      // Navigation
      languages: '언어',
      voiceType: '음성 유형',
      account: '계정',
      profile: '프로필',
      settings: '설정',
      history: '기록',
      login: '로그인',
      register: '회원가입',
      logout: '로그아웃',

      // Language Selection
      youSpeak: '당신이 말하는 언어:',
      partnerSpeaks: '상대방이 말하는 언어:',
      speakingSpeed: '말하기 속도:',
      slow: '느리게',
      fast: '빠르게',

      // Main App
      start: '시작',
      end: '종료',
      clear: '지우기',
      translate: '번역',
      typeMessage: '여기에 메시지를 입력하세요...',
      typePartnerMessage: '상대방의 메시지를 여기에 입력하세요...',
      maxWords: '최대 200단어',
      characters: '글자',

      // Conversation
      youSpeakLabel: '당신이 말함',
      partnerSpeaksLabel: '상대방이 말함',
      hears: '듣는다',

      // History Modal
      conversationHistory: '대화 기록',
      clearAll: '모두 지우기',
      play: '재생',
      delete: '삭제',
      confidence: '신뢰도',
      recorded: '녹음됨',

      // Status Messages
      processing: '처리 중...',
      recording: '녹음 중...',
      translating: '번역 중...',
      error: '오류',
      success: '성공',
    },

    zh: {
      // Navigation
      languages: '语言',
      voiceType: '语音类型',
      account: '账户',
      profile: '个人资料',
      settings: '设置',
      history: '历史记录',
      login: '登录',
      register: '注册',
      logout: '退出',

      // Language Selection
      youSpeak: '您说的语言:',
      partnerSpeaks: '对方说的语言:',
      speakingSpeed: '语速:',
      slow: '慢',
      fast: '快',

      // Main App
      start: '开始',
      end: '结束',
      clear: '清除',
      translate: '翻译',
      typeMessage: '在此输入您的消息...',
      typePartnerMessage: '在此输入对方的消息...',
      maxWords: '最多200字',
      characters: '字符',

      // Conversation
      youSpeakLabel: '您说',
      partnerSpeaksLabel: '对方说',
      hears: '听到',

      // History Modal
      conversationHistory: '对话历史',
      clearAll: '全部清除',
      play: '播放',
      delete: '删除',
      confidence: '置信度',
      recorded: '已录制',

      // Status Messages
      processing: '处理中...',
      recording: '录音中...',
      translating: '翻译中...',
      error: '错误',
      success: '成功',
    },

    ru: {
      // Navigation
      languages: 'Языки',
      voiceType: 'Тип голоса',
      account: 'Аккаунт',
      profile: 'Профиль',
      settings: 'Настройки',
      history: 'История',
      login: 'Войти',
      register: 'Регистрация',
      logout: 'Выйти',

      // Language Selection
      youSpeak: 'Вы говорите:',
      partnerSpeaks: 'Партнер говорит:',
      speakingSpeed: 'Скорость речи:',
      slow: 'Медленно',
      fast: 'Быстро',

      // Main App
      start: 'Начать',
      end: 'Завершить',
      clear: 'Очистить',
      translate: 'Перевести',
      typeMessage: 'Введите ваше сообщение здесь...',
      typePartnerMessage: 'Введите сообщение партнера здесь...',
      maxWords: 'макс. 200 слов',
      characters: 'символов',

      // Conversation
      youSpeakLabel: 'Вы говорите',
      partnerSpeaksLabel: 'Партнер говорит',
      hears: 'слышит',

      // History Modal
      conversationHistory: 'История разговоров',
      clearAll: 'Очистить все',
      play: 'Воспроизвести',
      delete: 'Удалить',
      confidence: 'Уверенность',
      recorded: 'Записано',

      // Status Messages
      processing: 'Обработка...',
      recording: 'Запись...',
      translating: 'Перевод...',
      error: 'Ошибка',
      success: 'Успешно',
    },
  };

  constructor() {}

  setLanguage(language: string) {
    if (this.translations[language]) {
      this.currentLanguage.next(language);
    }
  }

  getCurrentLanguage(): string {
    return this.currentLanguage.value;
  }

  getTranslation(key: keyof TranslationKeys): string {
    const currentLang = this.currentLanguage.value;
    const translation = this.translations[currentLang];
    return translation ? translation[key] : this.translations['en'][key];
  }

  getAllTranslations(): TranslationKeys {
    const currentLang = this.currentLanguage.value;
    return this.translations[currentLang] || this.translations['en'];
  }
}
