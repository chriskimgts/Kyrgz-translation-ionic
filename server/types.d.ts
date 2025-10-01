// Type definitions for the live translator server
export interface TranscriptionRequest {
  audio: File;
  translateToEnglish: boolean;
}

export interface TranscriptionResponse {
  text: string;
}

export interface TranslateRequest {
  text: string;
  target: "ky" | "en" | "ko" | "zh" | "ru" | "kk" | "tg" | "tk" | "uz";
}

export type UserLanguage = "en" | "ko" | "zh";
export type PartnerLanguage = "ky" | "ru" | "kk" | "tg" | "tk" | "uz";

export interface TranslateResponse {
  text: string;
}

export interface TTSRequest {
  text: string;
  voice?: string;
  format?: "mp3" | "wav";
}
