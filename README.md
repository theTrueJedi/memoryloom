# ThoughtLoom

A beautiful, AI-powered journal app for capturing and exploring your thoughts with intelligent tagging and sentiment analysis.

## Features

- **Free-form Journal Entries**: Write your thoughts naturally with support for long or short entries
- **Smart Tagging**: Use #hashtags anywhere in your entries to categorize your thoughts
- **AI Sentiment Analysis**: Powered by Google Gemini to analyze the emotional tone of each entry
- **Intelligent Tag Suggestions**: AI recommends relevant existing tags or suggests new ones
- **Dynamic Tag Feeds**: Filter and explore your thoughts by specific topics/tags
- **Google OAuth**: Secure authentication with persistent cloud storage
- **Beautiful UI**: Soft purple/lavender color scheme with smooth animations

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Firebase (Firestore + Authentication)
- **AI**: Google Gemini API
- **Styling**: Custom CSS with modern design system

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Google account for OAuth testing
- A Gemini API key (get one at https://aistudio.google.com/app/apikey)

### Installation

1. **Clone and install dependencies**:
   ```bash
   cd thoughtloom
   npm install
   ```

2. **Configure Gemini API**:
   - Get your API key from https://aistudio.google.com/app/apikey
   - Open `.env.local` and replace `your_gemini_api_key_here` with your actual API key:
     ```
     VITE_GEMINI_API_KEY=your_actual_api_key_here
     ```

3. **Set up Firebase Authentication**:
   - Go to the [Firebase Console](https://console.firebase.google.com/)
   - Select the "thoughtloom-918bd" project
   - Navigate to Authentication → Sign-in method
   - Enable Google as a sign-in provider
   - Add your development domain (e.g., `localhost`) to authorized domains

4. **Set up Firestore Database**:
   - In Firebase Console, go to Firestore Database
   - Create database in production mode
   - Set up security rules (see below)

5. **Start the development server**:
   ```bash
   npm run dev
   ```

6. **Open the app**:
   - Navigate to http://localhost:5173
   - Sign in with your Google account

## Firebase Security Rules

In the Firebase Console, go to Firestore Database → Rules and paste:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Project Structure

```
thoughtloom/
├── src/
│   ├── components/
│   │   ├── Capture/          # Thought input and tag management
│   │   ├── Explore/          # Search, filtering, and tag suggestions
│   │   ├── Auth/             # Google sign-in
│   │   └── Layout/           # Navigation and layout
│   ├── services/
│   │   ├── firebase.ts       # Firebase initialization
│   │   ├── auth.ts           # Authentication helpers
│   │   ├── firestore.ts      # Database operations
│   │   ├── gemini.ts         # AI integration
│   │   └── tagExtraction.ts  # Tag parsing utilities
│   ├── hooks/                # Custom React hooks
│   ├── contexts/             # React context providers
│   ├── types/                # TypeScript type definitions
│   └── styles/               # CSS theme
├── package.json
└── vite.config.ts
```

## Usage

### Capture Tab

1. **Write your thought** in the large text box
2. **Add #tags** anywhere in your text (e.g., "Had a great day at #work!")
3. **Press Cmd+Enter** or click "Save Thought"
4. The app will:
   - Extract your tags automatically
   - Analyze sentiment using AI
   - Generate tag suggestions in the background
   - Store everything securely in Firestore

### Explore Tab

1. **Search** for specific words or phrases
2. **Filter by tag** by clicking on any tag
3. **Review AI suggestions** and accept/reject them
4. **Browse all thoughts** in reverse chronological order
5. **See sentiment indicators** (emoji) for each thought

## Data Models

### Thought
- `content`: Your journal entry text
- `tags`: Array of tag strings
- `sentiment`: AI-analyzed emotional tone (score, magnitude, label)
- `timestamp`: When the thought was created

### Tag
- `name`: Tag identifier
- `usageCount`: How many times you've used this tag
- `firstUsed` / `lastUsed`: Temporal tracking

### Tag Suggestion
- `suggestedTag`: Tag name
- `isNewTag`: Whether it's a new tag or existing
- `reason`: AI's explanation for the suggestion
- `status`: pending/accepted/rejected

## Development

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Cost Considerations

- **Firebase**: Free tier includes 50K reads/20K writes per day
- **Gemini API**: Free tier includes 1,500 requests per day
- For personal use, you should stay well within free limits

## Future Enhancements

- Export thoughts as PDF/JSON
- Analytics dashboard (sentiment trends over time)
- Rich text editing
- Image attachments
- Search filters (by date range, sentiment)
- Dark mode
- Mobile app (React Native)

## Contributing

This is a personal project, but suggestions and feedback are welcome! Feel free to open issues for bugs or feature requests.

## License

MIT License - feel free to use this code for your own projects!

---

Built with love using React, Firebase, and Google Gemini AI 💜
