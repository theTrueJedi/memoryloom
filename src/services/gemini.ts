import { getFunctions, httpsCallable } from 'firebase/functions';
import app from './firebase';
import { Sentiment, YarnSettings } from '../types';

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

const processThoughtFn = httpsCallable<
  {
    thoughtId: string;
    userId: string;
    content: string;
    existingTags: string[];
    context?: TagSuggestionContext;
  },
  {
    sentiment: Sentiment;
    tagSuggestions: {
      existingTags: string[];
      newTag: string | null;
      reasoning: string;
    };
  }
>(functions, 'processThought');

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

/**
 * Process a new thought: analyze sentiment and suggest tags in parallel.
 * The Cloud Function updates the thought's sentiment directly in Firestore.
 * Returns tag suggestions for the client to handle.
 */
export const processThought = async (
  thoughtId: string,
  userId: string,
  content: string,
  existingTags: string[],
  context?: TagSuggestionContext
): Promise<{
  sentiment: Sentiment;
  tagSuggestions: {
    existingTags: string[];
    newTag: string | null;
    reasoning: string;
  };
}> => {
  try {
    const result = await processThoughtFn({
      thoughtId,
      userId,
      content,
      existingTags,
      context,
    });
    return result.data;
  } catch (error) {
    console.error('Error processing thought:', error);
    // Return fallback values - sentiment will remain as 'processing'
    // which signals to the user that something went wrong
    return {
      sentiment: {
        score: 0,
        magnitude: 0.5,
        label: 'neutral',
      },
      tagSuggestions: {
        existingTags: [],
        newTag: null,
        reasoning: 'Error generating suggestions',
      },
    };
  }
};

// Cloud Function reference for spinning yarns
const spinYarnFn = httpsCallable<
  {
    userId: string;
    tagName: string;
    forceRegenerate?: boolean;
    settings?: YarnSettings;
  },
  {
    content: string;
    cached: boolean;
  }
>(functions, 'spinYarn');

/**
 * Spin a Yarn: Generate a narrative about experiences with a specific tag
 */
export const spinYarn = async (
  userId: string,
  tagName: string,
  forceRegenerate = false,
  settings?: YarnSettings
): Promise<{ content: string; cached: boolean }> => {
  try {
    const result = await spinYarnFn({ userId, tagName, forceRegenerate, settings });
    return result.data;
  } catch (error) {
    console.error('Error spinning yarn:', error);
    throw error;
  }
};
