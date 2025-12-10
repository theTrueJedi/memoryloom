import { getFunctions, httpsCallable } from 'firebase/functions';
import app from './firebase';
import { Sentiment } from '../types';

// Initialize Firebase Functions
const functions = getFunctions(app);

// Cloud Function references
const analyzeSentimentFn = httpsCallable<{ content: string }, Sentiment>(
  functions,
  'analyzeSentiment'
);

const suggestTagsFn = httpsCallable<
  {
    content: string;
    existingTags: string[];
    context?: TagSuggestionContext;
  },
  {
    existingTags: string[];
    newTag: string | null;
    reasoning: string;
  }
>(functions, 'suggestTags');

export interface TagSuggestionContext {
  thoughts: Array<{
    content: string;
    tags: string[];
    sentiment: Sentiment;
  }>;
}

/**
 * Analyze sentiment of a thought using Cloud Function + Vertex AI
 */
export const analyzeSentiment = async (content: string): Promise<Sentiment> => {
  try {
    const result = await analyzeSentimentFn({ content });
    return result.data;
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    // Fallback to neutral
    return {
      score: 0,
      magnitude: 0.5,
      label: 'neutral',
    };
  }
};

/**
 * Suggest tags for a thought using Cloud Function + Vertex AI
 */
export const suggestTags = async (
  content: string,
  existingTags: string[],
  context?: TagSuggestionContext
): Promise<{
  existingTags: string[];
  newTag: string | null;
  reasoning: string;
}> => {
  try {
    const result = await suggestTagsFn({ content, existingTags, context });
    return result.data;
  } catch (error) {
    console.error('Error suggesting tags:', error);
    return {
      existingTags: [],
      newTag: null,
      reasoning: 'Error generating suggestions',
    };
  }
};
