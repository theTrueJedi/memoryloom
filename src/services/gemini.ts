import { GoogleGenerativeAI } from '@google/generative-ai';
import { Sentiment } from '../types';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey || apiKey === 'your_gemini_api_key_here') {
  console.warn(
    '⚠️  Gemini API key not configured. Please add your API key to .env.local'
  );
}

const genAI = apiKey && apiKey !== 'your_gemini_api_key_here'
  ? new GoogleGenerativeAI(apiKey)
  : null;

/**
 * Analyze sentiment of a thought using Gemini
 */
export const analyzeSentiment = async (content: string): Promise<Sentiment> => {
  if (!genAI) {
    // Fallback: return neutral sentiment if API not configured
    console.warn('Gemini API not configured, using neutral sentiment');
    return {
      score: 0,
      magnitude: 0.5,
      label: 'neutral',
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const prompt = `Analyze the emotional content of this journal entry and respond with ONLY valid JSON (no markdown, no code blocks):
{
  "score": <number between -1 and 1>,
  "magnitude": <number from 0 to infinity>,
  "label": "<primary emotion>",
  "secondaryLabel": "<secondary emotion or null>"
}

Guidelines:
- score: -1 (very negative) to 1 (very positive) - overall emotional valence
- magnitude: intensity of emotion (0 = no emotion, 1-2 = mild, 3-5 = moderate, 6+ = strong)
- label: Pick the PRIMARY most dominant emotion from this list
- secondaryLabel: Pick the SECONDARY emotion (if present), or null if only one clear emotion exists

  Positive emotions:
  - joy: Happy, delighted, cheerful, upbeat
  - gratitude: Thankful, appreciative, blessed
  - pride: Accomplished, successful, validated
  - excitement: Eager, enthusiastic, energized, pumped
  - love: Affectionate, caring, warm, connected
  - peace: Calm, serene, content, tranquil
  - hope: Optimistic, encouraged, looking forward
  - curiosity: Interested, inquisitive, engaged, wondering
  - surprise: Amazed, shocked, astonished (in a positive way)

  Negative emotions:
  - sadness: Unhappy, down, melancholic, blue, grieving
  - anxiety: Worried, nervous, stressed, overwhelmed, tense
  - anger: Frustrated, irritated, upset, mad, annoyed
  - fear: Scared, afraid, threatened, panicked
  - shame: Embarrassed, guilty, regretful, self-critical
  - loneliness: Isolated, disconnected, alone, abandoned
  - disappointment: Let down, discouraged, defeated
  - boredom: Unengaged, restless, unmotivated, stuck

  Neutral/Other:
  - confusion: Uncertain, unclear, puzzled, conflicted
  - neutral: Balanced, unremarkable, matter-of-fact
  - mixed: Multiple strong competing emotions

Choose the PRIMARY emotion that best captures the dominant emotional tone, and a SECONDARY emotion if another significant emotion is present.

Entry: "${content.replace(/"/g, '\\"')}"`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Remove markdown code blocks if present
    const jsonText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const sentiment = JSON.parse(jsonText);

    return {
      score: Number(sentiment.score),
      magnitude: Number(sentiment.magnitude),
      label: sentiment.label,
      secondaryLabel: sentiment.secondaryLabel || undefined,
    };
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
 * Suggest tags for a thought using Gemini
 */
export const suggestTags = async (
  content: string,
  existingTags: string[]
): Promise<{
  existingTags: string[];
  newTag: string | null;
  reasoning: string;
}> => {
  if (!genAI) {
    // Fallback: no suggestions if API not configured
    return {
      existingTags: [],
      newTag: null,
      reasoning: 'Gemini API not configured',
    };
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const existingTagsList = existingTags.length > 0 ? existingTags.join(', ') : 'none';

    const prompt = `Given this journal entry and the user's existing tags, suggest:
1. Which existing tags are relevant (if any)
2. If a new tag should be created (and what it should be)

Existing tags: ${existingTagsList}
Entry: "${content.replace(/"/g, '\\"')}"

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "existingTags": ["tag1", "tag2"],
  "newTag": "suggested-new-tag" or null,
  "reasoning": "brief explanation"
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Remove markdown code blocks if present
    const jsonText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const suggestions = JSON.parse(jsonText);

    return {
      existingTags: suggestions.existingTags || [],
      newTag: suggestions.newTag || null,
      reasoning: suggestions.reasoning || '',
    };
  } catch (error) {
    console.error('Error suggesting tags:', error);
    return {
      existingTags: [],
      newTag: null,
      reasoning: 'Error generating suggestions',
    };
  }
};
