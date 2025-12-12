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

// ============================================================
// SPIN A YARN - Generate narrative from tagged thoughts
// ============================================================

interface ThoughtData {
  content: string;
  tags: string[];
  sentiment: Sentiment;
  timestamp: FirebaseFirestore.Timestamp;
}

/**
 * Strip HTML tags from content for cleaner prompt text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Format a timestamp for display in the narrative prompt
 */
function formatDate(timestamp: FirebaseFirestore.Timestamp): string {
  const date = timestamp.toDate();
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Spin a Yarn: Generate a narrative about experiences with a specific tag
 */
interface YarnSettings {
  perspective: "first" | "second" | "third";
  delivery: "curt" | "normal" | "unabridged";
  coverage: "recent" | "month" | "allTime";
  style: string;
  customPrompt?: string;
}

export const spinYarn = onCall<{
  userId: string;
  tagName: string;
  forceRegenerate?: boolean;
  settings?: YarnSettings;
}>({ cors: true, timeoutSeconds: 120 }, async (request) => {
  // Verify user is authenticated
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated");
  }

  const { userId, tagName, forceRegenerate, settings } = request.data;

  // Verify the authenticated user matches the userId
  if (request.auth.uid !== userId) {
    throw new HttpsError("permission-denied", "User ID mismatch");
  }

  if (!tagName || typeof tagName !== "string") {
    throw new HttpsError("invalid-argument", "tagName is required");
  }

  // Check if custom settings are provided (non-default)
  const hasCustomSettings =
    settings &&
    (settings.perspective !== "second" ||
      settings.delivery !== "normal" ||
      settings.coverage !== "allTime" ||
      settings.style !== "yourVoice" ||
      (settings.customPrompt && settings.customPrompt.trim() !== ""));

  try {
    // Check for cached yarn (unless forcing regeneration or using custom settings)
    if (!forceRegenerate && !hasCustomSettings) {
      const yarnRef = firestore
        .collection("users")
        .doc(userId)
        .collection("yarns")
        .doc(tagName);
      const yarnSnap = await yarnRef.get();

      if (yarnSnap.exists) {
        const yarnData = yarnSnap.data();

        // If cached yarn doesn't have settings saved, update it with current settings
        if (!yarnData?.settings && settings) {
          await yarnRef.update({ settings });
        }

        return {
          content: yarnData?.content || "",
          cached: true,
        };
      }
    }

    // Query all thoughts with this tag, ordered by timestamp (chronological)
    const thoughtsRef = firestore
      .collection("users")
      .doc(userId)
      .collection("thoughts");

    // Build query with coverage filtering
    let taggedThoughtsQuery = thoughtsRef.where(
      "tags",
      "array-contains",
      tagName
    );

    // Apply coverage filter
    if (settings?.coverage === "recent") {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      taggedThoughtsQuery = taggedThoughtsQuery.where(
        "timestamp",
        ">=",
        admin.firestore.Timestamp.fromDate(fourteenDaysAgo)
      );
    } else if (settings?.coverage === "month") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      taggedThoughtsQuery = taggedThoughtsQuery.where(
        "timestamp",
        ">=",
        admin.firestore.Timestamp.fromDate(thirtyDaysAgo)
      );
    }

    taggedThoughtsQuery = taggedThoughtsQuery.orderBy("timestamp", "asc");

    const taggedThoughtsSnap = await taggedThoughtsQuery.get();

    if (taggedThoughtsSnap.empty) {
      throw new HttpsError("not-found", "No thoughts found with this tag");
    }

    const taggedThoughts: ThoughtData[] = taggedThoughtsSnap.docs.map(
      (doc) => doc.data() as ThoughtData
    );

    // Collect sentiment labels from tagged thoughts for voice sampling
    const sentimentLabels = new Set(
      taggedThoughts.map((t) => t.sentiment?.label).filter(Boolean)
    );

    // Query additional thoughts for voice reference (different tags, similar sentiments)
    // Get up to 5 sample thoughts prioritizing similar sentiments
    const allThoughtsQuery = thoughtsRef
      .orderBy("timestamp", "desc")
      .limit(50);

    const allThoughtsSnap = await allThoughtsQuery.get();
    const allThoughts: ThoughtData[] = allThoughtsSnap.docs.map(
      (doc) => doc.data() as ThoughtData
    );

    // Filter to thoughts NOT with this tag, prioritize similar sentiments
    const voiceSamples = allThoughts
      .filter((t) => !t.tags.includes(tagName))
      .sort((a, b) => {
        // Prioritize similar sentiments
        const aMatch = sentimentLabels.has(a.sentiment?.label) ? 1 : 0;
        const bMatch = sentimentLabels.has(b.sentiment?.label) ? 1 : 0;
        return bMatch - aMatch;
      })
      .slice(0, 5);

    // Build the prompt
    const voiceSamplesText =
      voiceSamples.length > 0
        ? voiceSamples
            .map((t) => `"${stripHtml(t.content).substring(0, 200)}..."`)
            .join("\n\n")
        : "No additional samples available.";

    const taggedThoughtsText = taggedThoughts
      .map((t) => {
        const date = formatDate(t.timestamp);
        const mood = t.sentiment?.label || "unknown";
        const content = stripHtml(t.content);
        return `**${date}** [Mood: ${mood}]\n${content}`;
      })
      .join("\n\n---\n\n");

    // Build dynamic prompt based on settings
    const perspectiveMap: Record<string, string> = {
      first: 'first person ("I", "my", "me")',
      second: 'second person ("you", "your")',
      third: 'third person ("they", "their", "them")',
    };
    const perspectiveText =
      perspectiveMap[settings?.perspective || "second"] ||
      perspectiveMap.second;

    const deliveryMap: Record<string, string> = {
      curt: "Brief and factual. Use a bulleted timeline format - each bullet has the date and a 1-2 sentence summary. No narrative prose or transitions between entries. Keep it scannable.",
      normal:
        "Write a concise 1-2 paragraph summary. Hit the key highlights only - distill the essence without lingering on details. Aim for brevity while maintaining narrative flow.",
      unabridged:
        "Write a 1-3 paragraph narrative, condensing and summarizing as needed to capture the essence.",
    };
    const deliveryText =
      deliveryMap[settings?.delivery || "normal"] || deliveryMap.normal;

    // Coverage context for recent/month
    let coverageContext = "";
    if (settings?.coverage === "recent" || settings?.coverage === "month") {
      coverageContext =
        '\nIMPORTANT: Start with a VERY brief recap of prior context for THIS TAG ONLY ("where we left off" or "before this period..."), then focus primarily on the entries shown. Do not reference other tags or unrelated topics.';
    }

    // Style guidance
    const styleMap: Record<string, string> = {
      yourVoice:
        "Match the author's natural writing style, tone, and vocabulary from the samples above.",
      greekMyth:
        "Write in the style of Greek mythology - epic language, references to fate and destiny, heroic framing of ordinary experiences.",
      medieval:
        "Write as a medieval chronicle - formal, archaic language, as if recorded by a scribe in an illuminated manuscript.",
      adventure:
        "Write with adventure pulp energy - vivid action words, tension, dramatic pacing, as if narrating an expedition.",
      pulp: "Write in pulp fiction style - punchy sentences, noir undertones, hardboiled narration with atmospheric prose.",
      western:
        "Write in Western frontier style - sparse, dusty prose, stoic tone, imagery of wide open spaces and rugged determination.",
      lovecraftian:
        "Write with cosmic horror undertones - hints of unknowable dread, purple prose, existential unease lurking beneath mundane events.",
      standup:
        "Write as a stand-up comedy bit - observational humor, self-deprecating wit, building tension through callbacks, and always land a punchline at the end.",
      documentary:
        "Write in the style of a nature documentary narrator like David Attenborough - measured, reverent tone, observing human behavior with gentle wonder as if documenting a fascinating species in its natural habitat.",
    };
    let styleText =
      styleMap[settings?.style || "yourVoice"] || styleMap.yourVoice;

    // If custom style (not in map), use the style value as custom instructions
    if (
      settings?.style &&
      !styleMap[settings.style] &&
      settings.style !== "yourVoice"
    ) {
      styleText = `Follow this style guidance: ${settings.style}`;
    }

    // Custom prompt additions
    const customPromptText =
      settings?.customPrompt && settings.customPrompt.trim()
        ? `\n\nAdditional Instructions from the author:\n${settings.customPrompt.trim()}`
        : "";

    const prompt = `You are capturing someone's personal journey in their own voice.

## Writing Style Reference
Here are samples of how this person writes (use these to match their tone, vocabulary, and style):

${voiceSamplesText}

## Their Journey with "${tagName}"
These entries are listed chronologically:

---

${taggedThoughtsText}

---

## Task
${deliveryText}

Write in ${perspectiveText}.${coverageContext}

## Style
${styleText}

## Guidelines
- Weave dates, months, and seasons naturally into the prose (e.g., "that December", "by late summer", "the March entry")
- Give it a journal-like quality - grounded in specific moments in time
- Follow chronological progression - show how things evolved over time
- Let the recorded moods/sentiments inform the emotional arc of the narrative
- Be evocative but factual - do not embellish or invent details not present in the entries
- If there's only one entry, write a brief vignette rather than a full narrative arc
- Avoid clichéd phrases like "your journey", "looking back", "little did you know"
- Do not use exclamation points unless the chosen style calls for it
- Write with literary restraint - understated is better than effusive${customPromptText}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const yarnContent =
      response.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!yarnContent) {
      throw new HttpsError("internal", "Failed to generate yarn content");
    }

    // Save to cache
    const yarnRef = firestore
      .collection("users")
      .doc(userId)
      .collection("yarns")
      .doc(tagName);

    await yarnRef.set({
      userId,
      tagName,
      content: yarnContent,
      settings: settings || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      content: yarnContent,
      cached: false,
    };
  } catch (error) {
    console.error("Error spinning yarn:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Failed to spin yarn");
  }
});

/**
 * Retell a single thought in multiple styles
 */
export const spinThought = onCall(
  {
    timeoutSeconds: 120,
    memory: "512MiB",
    region: "us-central1",
  },
  async (request) => {
    // Verify auth
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated to spin a thought"
      );
    }

    const { thoughtContent, styles } = request.data as {
      thoughtContent: string;
      styles: string[];
    };

    if (!thoughtContent || !styles || styles.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "Thought content and at least one style are required"
      );
    }

    // Style descriptions for prompts
    const styleDescriptions: Record<string, string> = {
      greekMyth:
        "Write in the style of Greek mythology - epic language, references to fate and destiny, heroic framing of ordinary experiences.",
      medieval:
        "Write as a medieval chronicle - formal, archaic language, as if recorded by a scribe in an illuminated manuscript.",
      adventure:
        "Write with adventure pulp energy - vivid action words, tension, dramatic pacing, as if narrating an expedition.",
      pulp: "Write in pulp fiction style - punchy sentences, noir undertones, hardboiled narration with atmospheric prose.",
      western:
        "Write in Western frontier style - sparse, dusty prose, stoic tone, imagery of wide open spaces and rugged determination.",
      lovecraftian:
        "Write with cosmic horror undertones - hints of unknowable dread, purple prose, existential unease lurking beneath mundane events.",
      standup:
        "Write as a stand-up comedy bit - observational humor, self-deprecating wit, building tension through callbacks, and always land a punchline at the end.",
      documentary:
        "Write in the style of a nature documentary narrator like David Attenborough - measured, reverent tone, observing human behavior with gentle wonder as if documenting a fascinating species in its natural habitat.",
    };

    try {
      const results: Record<string, string> = {};

      // Helper to process a single style
      const processStyle = async (style: string): Promise<{ style: string; content: string }> => {
        const styleDescription = styleDescriptions[style];
        if (!styleDescription) {
          return { style, content: "Unknown style" };
        }

        const prompt = `You are retelling a personal thought or journal entry in a specific literary style.

## Original Thought
${thoughtContent}

## Task
Retell this thought in the following style:
${styleDescription}

## Guidelines
- Preserve the core meaning and emotional essence of the original
- Keep the retelling concise - roughly the same length as the original
- Be evocative but faithful to the original content
- Do not add new facts or events not present in the original
- Write as a single paragraph or two at most
- Do not use quotation marks around the output
- Write directly in the style without meta-commentary`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const content =
          response.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return { style, content: content.trim() };
      };

      // Process styles in batches of 2 to avoid rate limiting
      const BATCH_SIZE = 2;
      for (let i = 0; i < styles.length; i += BATCH_SIZE) {
        const batch = styles.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(processStyle));
        for (const { style, content } of batchResults) {
          results[style] = content;
        }
      }

      return { results };
    } catch (error) {
      console.error("Error spinning thought:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError("internal", "Failed to spin thought");
    }
  }
);
