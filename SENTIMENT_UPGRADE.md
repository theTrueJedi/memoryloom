# Sentiment System Upgrade

## Overview
The sentiment analysis system has been upgraded from 4 basic categories (positive, negative, neutral, mixed) to **20 discrete emotions** for more nuanced emotional tracking.

## New Emotion Categories

### Positive Emotions (9)
- **joy** 😊 - Happy, delighted, cheerful, upbeat
- **gratitude** 🙏 - Thankful, appreciative, blessed
- **pride** 🌟 - Accomplished, successful, validated
- **excitement** 🎉 - Eager, enthusiastic, energized, pumped
- **love** ❤️ - Affectionate, caring, warm, connected
- **peace** ☮️ - Calm, serene, content, tranquil
- **hope** 🌅 - Optimistic, encouraged, looking forward
- **curiosity** 🤔 - Interested, inquisitive, engaged, wondering
- **surprise** 😲 - Amazed, shocked, astonished (in a positive way)

### Negative Emotions (8)
- **sadness** 😢 - Unhappy, down, melancholic, blue, grieving
- **anxiety** 😰 - Worried, nervous, stressed, overwhelmed, tense
- **anger** 😤 - Frustrated, irritated, upset, mad, annoyed
- **fear** 😨 - Scared, afraid, threatened, panicked
- **shame** 😳 - Embarrassed, guilty, regretful, self-critical
- **loneliness** 😔 - Isolated, disconnected, alone, abandoned
- **disappointment** 😞 - Let down, discouraged, defeated
- **boredom** 😑 - Unengaged, restless, unmotivated, stuck

### Neutral/Other (3)
- **confusion** 😕 - Uncertain, unclear, puzzled, conflicted
- **neutral** 😌 - Balanced, unremarkable, matter-of-fact
- **mixed** 😐 - Multiple strong competing emotions

## What Changed

### 1. Type Definitions (`src/types/index.ts`)
- Added `EmotionLabel` type with 20 emotion categories
- Updated `Sentiment` interface to use the new type

### 2. AI Analysis (`src/services/gemini.ts`)
- Enhanced prompt to provide detailed guidance on all 20 emotions
- Improved magnitude scale guidance (1-2 = mild, 3-5 = moderate, 6+ = strong)
- More detailed emotion descriptions for better AI classification

### 3. UI Components (`src/components/Explore/ThoughtCard.tsx`)
- Updated `getSentimentColor()` with unique colors for each emotion
- Updated `getSentimentEmoji()` with specific emojis for each emotion
- Each emotion now has a distinctive visual identity

### 4. Migration Tool
Two migration options created:

#### Option A: Web-based Admin Panel (Recommended)
- Navigate to the **Admin** tab in the app
- Click "Start Migration" to re-analyze all your thoughts
- Shows real-time progress with preview of current thought
- Handles errors gracefully
- Works entirely in the browser

#### Option B: Command-line Script
- Script located at `src/scripts/migrateSentiment.ts`
- Run with: `npm run migrate-sentiment` (requires installing `tsx` first)
- Processes all thoughts in the database

## How to Use the Migration Tool

1. **Start the app**: `npm run dev`
2. **Log in** to your account
3. **Navigate to the Admin tab** (new tab in the navigation)
4. **Click "Start Migration"**
5. **Wait for completion** - Progress is shown in real-time
6. **Refresh the page** to see updated emotions in the Explore tab

## Important Notes

- ⚠️ Migration will use your Gemini API quota (1 request per thought)
- ⏱️ Migration includes 1-second delays between requests to avoid rate limiting
- 🔄 You can run migration multiple times safely
- 💾 All thoughts are preserved - only sentiment metadata is updated
- 📊 Future thoughts will automatically use the new emotion categories

## Technical Details

### AI Model
- Using `gemini-2.0-flash-exp` for fast, cost-effective analysis
- JSON-only responses for reliability
- Fallback to neutral sentiment if API fails

### Data Structure
Each sentiment contains:
- `score`: -1 to 1 (overall emotional valence)
- `magnitude`: 0 to infinity (intensity of emotion)
- `label`: One of the 20 emotion categories

### Color Palette
- Positive emotions: Greens, warm colors (yellow, orange, pink)
- Negative emotions: Reds, blues, grays
- Neutral: Grays and purples
- Each color chosen for emotional association and visual distinction
