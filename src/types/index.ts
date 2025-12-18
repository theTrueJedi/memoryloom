import { Timestamp } from 'firebase/firestore';

export type EmotionLabel =
  | 'joy'           // Happy, delighted, cheerful
  | 'amusement'     // Entertained, laughing, finding something funny
  | 'gratitude'     // Thankful, appreciative
  | 'pride'         // Accomplished, successful
  | 'excitement'    // Eager, enthusiastic, energized
  | 'love'          // Affectionate, caring, warm
  | 'peace'         // Calm, serene, content
  | 'hope'          // Optimistic, encouraged
  | 'lucky'         // Fortunate, good karma, worked out well, serendipitous
  | 'creative'      // Inspired, imaginative, inventive; making/building/crafting
  | 'sadness'       // Unhappy, down, melancholic
  | 'anxiety'       // Worried, nervous, stressed
  | 'frustration'   // Annoyed, irritated, exasperated
  | 'anger'         // Furious, enraged, hostile, mad
  | 'fear'          // Scared, afraid, worried
  | 'shame'         // Embarrassed, guilty, regretful
  | 'loneliness'    // Isolated, disconnected
  | 'disappointment' // Let down, discouraged
  | 'confusion'     // Uncertain, unclear, puzzled
  | 'boredom'       // Unengaged, restless
  | 'surprise'      // Amazed, shocked, astonished
  | 'curiosity'     // Interested, inquisitive
  | 'neutral'       // Balanced, unremarkable
  | 'mixed'         // Multiple competing emotions
  | 'processing';   // Meta: sentiment analysis in progress

export interface Sentiment {
  score: number;      // -1 to 1 (overall valence)
  magnitude: number;  // 0 to infinity (intensity)
  label: EmotionLabel;
  secondaryLabel?: EmotionLabel;  // Optional secondary emotion
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

export interface SentimentSuggestion {
  id: string;
  userId: string;
  thoughtId: string;
  thoughtContent: string;
  previousSentiment: Sentiment;
  suggestedSentiment: Sentiment;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Timestamp;
}

export interface Yarn {
  id: string;
  userId: string;
  tagName: string;
  content: string;
  createdAt: Timestamp;
}

export interface YarnSettings {
  perspective: 'first' | 'second' | 'third';
  delivery: 'curt' | 'normal' | 'unabridged';
  coverage: 'recent' | 'month' | 'allTime';
  style: string;
  customPrompt: string;
}
