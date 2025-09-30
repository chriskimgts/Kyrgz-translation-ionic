import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  ConversationHistoryEntry,
  ConversationHistoryService,
} from '../conversation-history.service';

@Component({
  selector: 'app-conversation-history-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './conversation-history-modal.component.html',
  styleUrls: ['./conversation-history-modal.component.css'],
})
export class ConversationHistoryModalComponent
  implements OnInit, OnChanges, OnDestroy
{
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() playAudio = new EventEmitter<ConversationHistoryEntry>();
  @Output() clearMainConversations = new EventEmitter<void>();

  conversations: ConversationHistoryEntry[] = [];
  filteredConversations: ConversationHistoryEntry[] = [];
  searchQuery = '';
  isLoading = false;

  // Make Math available in template
  Math = Math;

  private subscription?: Subscription;

  constructor(private conversationHistoryService: ConversationHistoryService) {}

  ngOnInit(): void {
    console.log('Modal ngOnInit called, isOpen:', this.isOpen);
    this.subscription = this.conversationHistoryService.history$.subscribe(
      (conversations) => {
        console.log('Modal received conversations:', conversations.length);
        this.conversations = conversations;
        this.filterConversations();
      }
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    console.log('Modal ngOnChanges called, changes:', changes);
    console.log('Modal current isOpen value:', this.isOpen);
    if (changes['isOpen']) {
      console.log(
        'Modal isOpen changed from',
        changes['isOpen'].previousValue,
        'to',
        changes['isOpen'].currentValue
      );
      console.log('Modal isOpen changed to:', this.isOpen);
      if (this.isOpen) {
        console.log('Modal opened, conversations:', this.conversations.length);
        this.preventBodyScroll();
      } else {
        this.restoreBodyScroll();
      }
    }
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    // Ensure body scroll is restored when component is destroyed
    this.restoreBodyScroll();
  }

  onSearchChange(): void {
    this.filterConversations();
  }

  private filterConversations(): void {
    if (this.searchQuery.trim()) {
      this.filteredConversations =
        this.conversationHistoryService.searchConversations(this.searchQuery);
    } else {
      this.filteredConversations =
        this.conversationHistoryService.getConversationsSortedByTime();
    }
  }

  onClose(): void {
    console.log('Modal onClose() called');
    this.restoreBodyScroll();
    this.close.emit();
  }

  onPlayAudio(conversation: ConversationHistoryEntry): void {
    this.playAudio.emit(conversation);
  }

  onDeleteConversation(conversation: ConversationHistoryEntry): void {
    if (confirm('Are you sure you want to delete this conversation?')) {
      this.conversationHistoryService.deleteConversation(conversation.id);
    }
  }

  onClearAllHistory(): void {
    if (
      confirm(
        'Are you sure you want to clear all conversation history? This action cannot be undone.'
      )
    ) {
      this.conversationHistoryService.clearAllHistory();
      // Also emit an event to clear the main conversation arrays
      this.clearMainConversations.emit();
    }
  }

  onExportHistory(): void {
    const historyData = this.conversationHistoryService.exportHistory();
    const blob = new Blob([historyData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-history-${
      new Date().toISOString().split('T')[0]
    }.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  onImportHistory(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (this.conversationHistoryService.importHistory(content)) {
          alert('History imported successfully!');
        } else {
          alert('Failed to import history. Please check the file format.');
        }
      };
      reader.readAsText(file);
    }
  }

  formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffInHours < 24) {
      const diffInHoursFloor = Math.floor(diffInHours);
      return `${diffInHoursFloor} hour${diffInHoursFloor !== 1 ? 's' : ''} ago`;
    } else if (diffInHours < 168) {
      // 7 days
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }
  }

  formatDuration(duration?: number): string {
    if (!duration) return 'Unknown';
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  getTotalConversations(): number {
    return this.conversationHistoryService.getTotalConversations();
  }

  getTotalDuration(): string {
    const totalSeconds = this.conversationHistoryService.getTotalDuration();
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  trackByConversationId(
    index: number,
    conversation: ConversationHistoryEntry
  ): string {
    return conversation.id;
  }

  getDisplayStyle(): string {
    return this.isOpen ? 'flex' : 'none';
  }

  private preventBodyScroll(): void {
    // Store current scroll position
    const scrollY = window.scrollY;

    // Apply styles to prevent scrolling
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  }

  private restoreBodyScroll(): void {
    // Get the scroll position from the top style
    const scrollY = document.body.style.top;

    // Remove the fixed positioning styles
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';

    // Restore scroll position
    if (scrollY) {
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
  }
}
