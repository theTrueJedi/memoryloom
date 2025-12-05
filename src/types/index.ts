import { Timestamp } from 'firebase/firestore';

export interface Sentiment {
  score: number;      // -1 to 1
  magnitude: number;  // 0 to infinity
  label: 'positive' | 'negative' | 'neutral' | 'mixed';
}

export interface Thought {
  id: string;
  userId: string;
  content: string;
  tags: string[];
  sentiment: Sentiment;
  timestamp: Timestamp;
  createdAt: Timestamp;
}

export interface Tag {
  id: string;
  userId: string;
  name: string;
  usageCount: number;
  firstUsed: Timestamp;
  lastUsed: Timestamp;
}

export interface TagSuggestion {
  id: string;
  userId: string;
  thoughtId: string;
  suggestedTag: string;
  isNewTag: boolean;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Timestamp;
}
