# Quick Start Guide

Get ThoughtLoom running in 5 minutes!

## Step 1: Install Dependencies
```bash
npm install
```

## Step 2: Get Your Gemini API Key
1. Visit https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Copy your key

## Step 3: Configure Environment
Open `.env.local` and replace the placeholder:
```
VITE_GEMINI_API_KEY=paste_your_actual_key_here
```

## Step 4: Set Up Firebase (One-time)

### Enable Google Authentication:
1. Go to https://console.firebase.google.com/
2. Select project: **thoughtloom-918bd**
3. Navigate to **Authentication** → **Sign-in method**
4. Click **Google** → Enable → Save
5. Add `localhost` to authorized domains

### Create Firestore Database:
1. In Firebase Console, go to **Firestore Database**
2. Click **Create database**
3. Choose **production mode**
4. Select your preferred location
5. Click **Enable**

### Set Security Rules:
1. Go to **Firestore Database** → **Rules**
2. Paste this and publish:
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

## Step 5: Start the App
```bash
npm run dev
```

## Step 6: Open and Sign In
1. Open http://localhost:5173
2. Click "Sign in with Google"
3. Choose your Google account
4. Start journaling! 🎉

## Quick Tips

### Capture Tab
- Type your thoughts naturally
- Add #tags anywhere (e.g., "Great #meeting today!")
- Use Cmd+Enter (Mac) or Ctrl+Enter (Windows) to save
- Tags appear as toggles below the input

### Explore Tab
- Search for keywords
- Click tags to filter thoughts
- Review AI tag suggestions
- See sentiment indicators (😊 😔 😐 😌)

## Troubleshooting

**"Gemini API not configured"**
- Check that your API key is correct in `.env.local`
- Restart the dev server after editing `.env.local`

**"Permission denied" in Firestore**
- Make sure you're signed in
- Verify security rules are published
- Check that Google auth is enabled

**Can't sign in**
- Ensure Google provider is enabled in Firebase Auth
- Check that `localhost` is in authorized domains
- Try clearing browser cache/cookies

## Next Steps
- Read the full [README.md](./README.md) for detailed docs
- Customize the color scheme in `src/styles/theme.css`
- Add your own features!

Enjoy your journaling journey! 💜
