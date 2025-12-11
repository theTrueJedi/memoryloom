import { onCall, HttpsError } from "firebase-functions/v2/https";
import { VertexAI } from "@google-cloud/vertexai";
import * as admin from "firebase-admin";

// Initialize Firebase Admin
admin.initializeApp();
const firestore = admin.firestore();

// Initialize Vertex AI - uses default service account credentials
const vertexAI = new VertexAI({
  project: "thoughtloom-918bd",
  location: "us-central1",
});

const model = vertexAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

interface Sentiment {
  score: number;
  magnitude: number;
  label: string;
  secondaryLabel?: string;
}

interface TagSuggestionContext {
  thoughts: Array<{
    content: string;
    tags: string[];
    sentiment: Sentiment;
  }>;
}

interface TagSuggestionResult {
  existingTags: string[];
  newTag: string | null;
  reasoning: string;
}

// ============================================================
// CORE LOGIC FUNCTIONS (reusable internally)
// ============================================================

/**
 * Core sentiment analysis logic - can be called internally or via Cloud Function
 */
async function analyzeSentimentCore(content: string): Promise<Sentiment> {
  const prompt = `Analyze the emotional content of this journal entry and respond with ONLY valid JSON (no markdown, no code blocks).
The entry may be written in any language (English, Chinese, Spanish, etc.) - analyze the emotions regardless of language.

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
  - amusement: Entertained, laughing, finding something funny, humored
  - gratitude: Thankful, appreciative, blessed
  - pride: Accomplished, successful, validated
  - excitement: Eager, enthusiastic, energized, pumped
  - love: Affectionate, caring, warm, connected
  - peace: Calm, serene, content, tranquil
  - hope: Optimistic, encouraged, looking forward
  - creative: Inspired, imaginative, inventive, artistic, innovative; also use when describing creative projects, making/building things, crafting, designing, DIY projects, or artistic endeavors
  - curiosity: Interested, inquisitive, engaged, wondering
  - surprise: Amazed, shocked, astonished (in a positive way)

  Negative emotions:
  - sadness: Unhappy, down, melancholic, blue, grieving
  - anxiety: Worried, nervous, stressed, overwhelmed, tense
  - frustration: Annoyed, irritated, exasperated, bothered
  - anger: Furious, enraged, hostile, mad, livid
  - fear: Scared, afraid, threatened, panicked
  - shame: Embarrassed, guilty, regretful, self-critical
  - loneliness: Isolated, disconnected, alone, abandoned
  - disappointment: Let down, discouraged, defeated
  - boredom: Unengaged, restless, unmotivated, stuck

  Neutral/Other:
  - confusion: Uncertain, unclear, puzzled, conflicted
  - neutral: Balanced, unremarkable, matter-of-fact (use sparingly - only when no other emotion fits)
  - mixed: Multiple strong competing emotions

Choose the PRIMARY emotion that best captures the dominant emotional tone, and a SECONDARY emotion if another significant emotion is present.

IMPORTANT: Content matters as much as tone. If the entry describes:
- Making, building, designing, crafting, 3D printing, DIY projects, or artistic work → use "creative"
- Planning or looking forward to something → use "hope" or "excitement"
- Learning or exploring ideas → use "curiosity"
Do NOT default to "neutral" just because the writing style is matter-of-fact. Consider what the person is DOING or thinking about.

Entry: "${content.replace(/"/g, '\\"')}"`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Remove markdown code blocks if present
  const jsonText = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  const sentiment = JSON.parse(jsonText);

  return {
    score: Number(sentiment.score),
    magnitude: Number(sentiment.magnitude),
    label: sentiment.label,
    secondaryLabel: sentiment.secondaryLabel || undefined,
  };
}

/**
 * Analyze sentiment of a thought using Vertex AI Gemini (Cloud Function wrapper)
 */
export const analyzeSentiment = onCall<{ content: string }>(
  { cors: true },
  async (request) => {
    // Verify user is authenticated
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const { content } = request.data;
    if (!content || typeof content !== "string") {
      throw new HttpsError("invalid-argument", "Content is required");
    }

    try {
      return await analyzeSentimentCore(content);
    } catch (error) {
      console.error("Error analyzing sentiment:", error);
      throw new HttpsError("internal", "Failed to analyze sentiment");
    }
  }
);

/**
 * Core tag suggestion logic - can be called internally or via Cloud Function
 */
async function suggestTagsCore(
  content: string,
  existingTags: string[],
  context?: TagSuggestionContext
): Promise<TagSuggestionResult> {
  const existingTagsList =
    existingTags && existingTags.length > 0 ? existingTags.join(", ") : "none";

  // Build context sections for the prompt
  let contextSection = "";

  if (context && context.thoughts && context.thoughts.length > 0) {
    // Build tag co-occurrence patterns
    const tagPairs: { [key: string]: Set<string> } = {};
    const tagFrequency: { [key: string]: number } = {};

    context.thoughts.forEach((thought) => {
      // Track tag frequency
      thought.tags.forEach((tag) => {
        tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
      });

      // Track tag co-occurrence (which tags appear together)
      for (let i = 0; i < thought.tags.length; i++) {
        for (let j = i + 1; j < thought.tags.length; j++) {
          const tag1 = thought.tags[i];
          const tag2 = thought.tags[j];

          if (!tagPairs[tag1]) tagPairs[tag1] = new Set();
          if (!tagPairs[tag2]) tagPairs[tag2] = new Set();

          tagPairs[tag1].add(tag2);
          tagPairs[tag2].add(tag1);
        }
      }
    });

    // Build context string with most relevant information
    const topTags = Object.entries(tagFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag, count]) => `${tag} (${count} uses)`)
      .join(", ");

    const cooccurrenceExamples = Object.entries(tagPairs)
      .slice(0, 5)
      .map(
        ([tag, related]) =>
          `${tag} often appears with: ${Array.from(related).slice(0, 3).join(", ")}`
      )
      .join("\n  ");

    // Find similar thoughts (simple keyword matching)
    const contentWords = content
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    const similarThoughts = context.thoughts
      .map((thought) => {
        const thoughtWords = thought.content.toLowerCase().split(/\s+/);
        const matchCount = contentWords.filter((word) =>
          thoughtWords.includes(word)
        ).length;
        return { thought, matchCount };
      })
      .filter(({ matchCount }) => matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount)
      .slice(0, 3)
      .map(
        ({ thought }) =>
          `"${thought.content.substring(0, 80)}..." → tags: ${thought.tags.join(", ")}`
      );

    contextSection = `

Historical Context:
- Most used tags: ${topTags}
- Tag co-occurrence patterns:
  ${cooccurrenceExamples}
${
  similarThoughts.length > 0
    ? `- Similar past thoughts:
  ${similarThoughts.join("\n  ")}`
    : ""
}

Use this context to:
1. Prioritize tags that appear in similar thoughts
2. Suggest related tags that often appear together
3. Consider emotional patterns when relevant`;
  }

  const prompt = `Given this journal entry and the user's existing tags, suggest:
1. Which existing tags are relevant (if any)
2. If a new tag should be created (and what it should be)

The entry may be written in any language (English, Chinese, Spanish, etc.).
Tags can be in any language or a mix of languages - match the language the user tends to use for their tags, or use the language of the entry if no clear pattern exists.

Existing tags: ${existingTagsList}
Entry: "${content.replace(/"/g, '\\"')}"
${contextSection}

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "existingTags": ["tag1", "tag2"],
  "newTag": "suggested-new-tag" or null,
  "reasoning": "brief explanation"
}`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Remove markdown code blocks if present
  const jsonText = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  const suggestions = JSON.parse(jsonText);

  return {
    existingTags: suggestions.existingTags || [],
    newTag: suggestions.newTag || null,
    reasoning: suggestions.reasoning || "",
  };
}

/**
 * Suggest tags for a thought using Vertex AI Gemini (Cloud Function wrapper)
 */
export const suggestTags = onCall<{
  content: string;
  existingTags: string[];
  context?: TagSuggestionContext;
}>({ cors: true }, async (request) => {
  // Verify user is authenticated
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const { content, existingTags, context } = request.data;
  if (!content || typeof content !== "string") {
    throw new HttpsError("invalid-argument", "Content is required");
  }

  try {
    return await suggestTagsCore(content, existingTags, context);
  } catch (error) {
    console.error("Error suggesting tags:", error);
    throw new HttpsError("internal", "Failed to suggest tags");
  }
});

// ============================================================
// COMBINED PROCESSING FUNCTION (for new thoughts)
// ============================================================

/**
 * Process a new thought: analyze sentiment and suggest tags in parallel,
 * then update the thought in Firestore.
 *
 * This function is called asynchronously after a thought is saved with
 * 'processing' sentiment. It updates the thought with real results.
 */
export const processThought = onCall<{
  thoughtId: string;
  userId: string;
  content: string;
  existingTags: string[];
  context?: TagSuggestionContext;
}>({ cors: true }, async (request) => {
  // Verify user is authenticated
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const { thoughtId, userId, content, existingTags, context } = request.data;

  // Verify the authenticated user matches the userId
  if (request.auth.uid !== userId) {
    throw new HttpsError("permission-denied", "User ID mismatch");
  }

  if (!thoughtId || !content || typeof content !== "string") {
    throw new HttpsError("invalid-argument", "thoughtId and content are required");
  }

  try {
    // Run sentiment and tag analysis in parallel
    const [sentiment, tagSuggestions] = await Promise.all([
      analyzeSentimentCore(content),
      suggestTagsCore(content, existingTags, context),
    ]);

    // Update the thought in Firestore with the sentiment
    const thoughtRef = firestore
      .collection("users")
      .doc(userId)
      .collection("thoughts")
      .doc(thoughtId);

    // Build sentiment object without undefined values (Firestore rejects undefined)
    const sentimentData: Record<string, unknown> = {
      score: sentiment.score,
      magnitude: sentiment.magnitude,
      label: sentiment.label,
    };
    if (sentiment.secondaryLabel) {
      sentimentData.secondaryLabel = sentiment.secondaryLabel;
    }

    await thoughtRef.update({
      sentiment: sentimentData,
    });

    // Return results (tag suggestions will be handled by client to create TagSuggestion docs)
    return {
      sentiment,
      tagSuggestions,
    };
  } catch (error) {
    console.error("Error processing thought:", error);
    throw new HttpsError("internal", "Failed to process thought");
  }
});
