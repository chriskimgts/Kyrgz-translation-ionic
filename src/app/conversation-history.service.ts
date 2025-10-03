import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ConversationHistoryEntry {
  id: string;
  timestamp: number;
  originalText: string;
  translatedText: string;
  userLanguage: string;
  targetLanguage: string;
  audioUrl?: string;
  audioBlob?: Blob;
  audioData?: string; // Base64 encoded audio data for persistence
  confidence: number;
  duration?: number; // Duration of the audio in seconds
}

@Injectable({
  providedIn: 'root',
})
export class ConversationHistoryService {
  private readonly STORAGE_KEY_PREFIX = 'conversationHistory_';
  private currentUserId: string = 'anonymous'; // Default user ID
  private historySubject = new BehaviorSubject<ConversationHistoryEntry[]>([]);
  public history$ = this.historySubject.asObservable();

  constructor() {
    this.loadHistoryFromStorage();
  }

  // Set the current user and load their specific history
  setCurrentUser(userId: string): void {
    console.log('📝 Setting conversation history for user:', userId);
    this.currentUserId = userId || 'anonymous';
    this.loadHistoryFromStorage();
  }

  // Get the storage key for the current user
  private getStorageKey(): string {
    return this.STORAGE_KEY_PREFIX + this.currentUserId;
  }

  private loadHistoryFromStorage(): void {
    try {
      const storageKey = this.getStorageKey();
      const stored = localStorage.getItem(storageKey);
      console.log(
        `📂 Loading history for user ${this.currentUserId} from key: ${storageKey}`
      );

      if (stored) {
        const history = JSON.parse(stored);

        // Validate and fix conversation entries
        const validatedHistory = history.map((entry: any) => ({
          ...entry,
          id: entry.id || this.generateId(), // Generate ID if missing
          timestamp: entry.timestamp || Date.now(), // Use current time if missing
        }));

        this.historySubject.next(validatedHistory);
        console.log(
          `✅ Loaded ${validatedHistory.length} conversations for user ${this.currentUserId}`
        );
      } else {
        this.historySubject.next([]);
        console.log(`📭 No history found for user ${this.currentUserId}`);
      }
    } catch (error) {
      console.error('Error loading conversation history:', error);
      this.historySubject.next([]);
    }
  }

  private saveHistoryToStorage(history: ConversationHistoryEntry[]): void {
    try {
      const storageKey = this.getStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(history));
      console.log(
        `💾 Saved ${history.length} conversations for user ${this.currentUserId}`
      );
    } catch (error) {
      console.error('Error saving conversation history:', error);
    }
  }

  addConversation(
    entry: Omit<ConversationHistoryEntry, 'id' | 'timestamp'>
  ): void {
    const newEntry: ConversationHistoryEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    const currentHistory = this.historySubject.value;
    const updatedHistory = [newEntry, ...currentHistory]; // Add to beginning for newest first
    this.historySubject.next(updatedHistory);
    this.saveHistoryToStorage(updatedHistory);
  }

  getConversations(): ConversationHistoryEntry[] {
    return this.historySubject.value;
  }

  getConversationsSortedByTime(): ConversationHistoryEntry[] {
    return [...this.historySubject.value].sort(
      (a, b) => b.timestamp - a.timestamp
    );
  }

  searchConversations(query: string): ConversationHistoryEntry[] {
    if (!query.trim()) {
      return this.getConversationsSortedByTime();
    }

    const searchTerm = query.toLowerCase().trim();
    return this.getConversationsSortedByTime().filter(
      (entry) =>
        entry.originalText.toLowerCase().includes(searchTerm) ||
        entry.translatedText.toLowerCase().includes(searchTerm) ||
        entry.userLanguage.toLowerCase().includes(searchTerm) ||
        entry.targetLanguage.toLowerCase().includes(searchTerm)
    );
  }

  deleteConversation(id: string): void {
    const currentHistory = this.historySubject.value;
    const updatedHistory = currentHistory.filter((entry) => entry.id !== id);
    this.historySubject.next(updatedHistory);
    this.saveHistoryToStorage(updatedHistory);
  }

  clearAllHistory(): void {
    this.historySubject.next([]);
    this.saveHistoryToStorage([]);
  }

  getConversationById(id: string): ConversationHistoryEntry | undefined {
    return this.historySubject.value.find((entry) => entry.id === id);
  }

  getTotalConversations(): number {
    return this.historySubject.value.length;
  }

  getTotalDuration(): number {
    return this.historySubject.value.reduce(
      (total, entry) => total + (entry.duration || 0),
      0
    );
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Convert audio URL to base64 data for persistent storage
  async convertAudioUrlToBase64(audioUrl: string): Promise<string | null> {
    try {
      const response = await fetch(audioUrl);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          resolve(base64);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error converting audio to base64:', error);
      return null;
    }
  }

  // Convert base64 data back to blob URL for playback
  convertBase64ToBlobUrl(base64Data: string): string {
    return base64Data; // Base64 data URLs can be used directly
  }

  // Export history as JSON
  exportHistory(): string {
    return JSON.stringify(this.getConversationsSortedByTime(), null, 2);
  }

  // Import history from JSON
  importHistory(jsonData: string): boolean {
    try {
      const importedHistory = JSON.parse(jsonData);
      if (Array.isArray(importedHistory)) {
        this.historySubject.next(importedHistory);
        this.saveHistoryToStorage(importedHistory);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error importing conversation history:', error);
      return false;
    }
  }
}
