/**
 * Migration script to re-analyze sentiment for all existing thoughts
 * Run this once to update all thoughts with the new emotion labels
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Sentiment } from '../types';

// Firebase config - you'll need to provide this
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// Gemini API config
const geminiApiKey = process.env.VITE_GEMINI_API_KEY;

if (!geminiApiKey) {
  console.error('❌ VITE_GEMINI_API_KEY not found in environment variables');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(geminiApiKey);

/**
 * Analyze sentiment using the new emotion categories
 */
const analyzeSentiment = async (content: string): Promise<Sentiment> => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const prompt = `Analyze the emotional content of this journal entry and respond with ONLY valid JSON (no markdown, no code blocks):
{
  "score": <number between -1 and 1>,
  "magnitude": <number from 0 to infinity>,
  "label": "<emotion>"
}

Guidelines:
- score: -1 (very negative) to 1 (very positive) - overall emotional valence
- magnitude: intensity of emotion (0 = no emotion, 1-2 = mild, 3-5 = moderate, 6+ = strong)
- label: Pick the SINGLE most dominant emotion from this list:

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

Choose the emotion that best captures the PRIMARY emotional tone of the entry.

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
    };
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    throw error;
  }
};

/**
 * Main migration function
 */
const migrateSentiments = async () => {
  console.log('🚀 Starting sentiment migration...\n');

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  try {
    // Get all thoughts from all users
    const thoughtsRef = collection(db, 'thoughts');
    const snapshot = await getDocs(thoughtsRef);

    console.log(`📊 Found ${snapshot.size} thoughts to process\n`);

    let processed = 0;
    let failed = 0;
    const errors: Array<{ id: string; error: string }> = [];

    // Process each thought
    for (const thoughtDoc of snapshot.docs) {
      const thought = thoughtDoc.data();
      const thoughtId = thoughtDoc.id;

      try {
        console.log(`Processing thought ${processed + 1}/${snapshot.size}: ${thoughtId}`);
        console.log(`  Content preview: ${thought.content.substring(0, 50)}...`);
        console.log(`  Old sentiment: ${thought.sentiment?.label || 'none'}`);

        // Re-analyze sentiment
        const newSentiment = await analyzeSentiment(thought.content);

        console.log(`  New sentiment: ${newSentiment.label} (score: ${newSentiment.score.toFixed(2)}, magnitude: ${newSentiment.magnitude.toFixed(2)})`);

        // Update the thought document
        await updateDoc(doc(db, 'thoughts', thoughtId), {
          sentiment: newSentiment,
        });

        processed++;
        console.log('  ✅ Updated successfully\n');

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({ id: thoughtId, error: errorMessage });
        console.error(`  ❌ Failed: ${errorMessage}\n`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📈 Migration Summary:');
    console.log('='.repeat(50));
    console.log(`Total thoughts: ${snapshot.size}`);
    console.log(`✅ Successfully processed: ${processed}`);
    console.log(`❌ Failed: ${failed}`);

    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach(({ id, error }) => {
        console.log(`  - ${id}: ${error}`);
      });
    }

    console.log('\n✨ Migration complete!');

  } catch (error) {
    console.error('💥 Fatal error during migration:', error);
    process.exit(1);
  }
};

// Run the migration
migrateSentiments()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
