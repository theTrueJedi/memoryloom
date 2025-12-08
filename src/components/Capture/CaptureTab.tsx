import React, { useState, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useThoughts } from '../../hooks/useThoughts';
import { useTags } from '../../hooks/useTags';
import ThoughtInput from './ThoughtInput';
import TagToggleList from './TagToggleList';
import { analyzeSentiment } from '../../services/gemini';
import { createTagSuggestion } from '../../services/firestore';
import { suggestTags } from '../../services/gemini';
import { stripTags } from '../../services/tagExtraction';

const CaptureTab: React.FC = () => {
  const { user } = useAuth();
  const { addThought, thoughts } = useThoughts(user?.uid);
  const { tags } = useTags(user?.uid);

  const [thoughtText, setThoughtText] = useState('');
  const [detectedTags, setDetectedTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleTagsDetected = useCallback((tags: string[]) => {
    setDetectedTags(tags);
  }, []);

  const handleSubmit = async () => {
    if (!thoughtText.trim() || !user) return;

    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      // Strip hashtags from the content before saving
      const contentWithoutTags = stripTags(thoughtText);

      // Analyze sentiment on the original text (with tags for context)
      const sentiment = await analyzeSentiment(thoughtText);

      // Create thought with cleaned content (no hashtags)
      const thoughtId = await addThought(contentWithoutTags, detectedTags, sentiment);

      if (thoughtId) {
        // Generate tag suggestions asynchronously (don't await)
        if (user.uid) {
          generateTagSuggestions(user.uid, thoughtId, thoughtText, tags.map(t => t.name))
            .catch(err => console.error('Error generating tag suggestions:', err));
        }

        // Clear form and show success message
        setThoughtText('');
        setDetectedTags([]);
        setSuccessMessage('Thought saved successfully!');

        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setErrorMessage('Failed to save thought. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting thought:', error);
      setErrorMessage('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateTagSuggestions = async (
    userId: string,
    thoughtId: string,
    content: string,
    existingTagNames: string[]
  ) => {
    try {
      // Build historical context from recent thoughts
      const context = {
        thoughts: thoughts.map(t => ({
          content: t.content,
          tags: t.tags,
          sentiment: t.sentiment,
        }))
      };

      const suggestions = await suggestTags(content, existingTagNames, context);

      // Create suggestion for existing tags
      for (const tag of suggestions.existingTags) {
        if (!detectedTags.includes(tag)) {
          await createTagSuggestion(
            userId,
            thoughtId,
            tag,
            false,
            `AI suggested existing tag: ${suggestions.reasoning}`
          );
        }
      }

      // Create suggestion for new tag
      if (suggestions.newTag && !detectedTags.includes(suggestions.newTag)) {
        await createTagSuggestion(
          userId,
          thoughtId,
          suggestions.newTag,
          true,
          `AI suggested new tag: ${suggestions.reasoning}`
        );
      }
    } catch (error) {
      console.error('Error in generateTagSuggestions:', error);
    }
  };

  return (
    <div className="capture-tab">
      <div className="capture-header">
        <img src="/memoryloom_icon.svg" alt="MemoryLoom" className="capture-logo" />
        <h2 className="gradient-text">Weave Your Thoughts</h2>
        <p className="subtitle">Add a new strand to your fabric</p>
      </div>

      {successMessage && (
        <div className="alert alert-success">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="alert alert-error">
          {errorMessage}
        </div>
      )}

      <ThoughtInput
        value={thoughtText}
        onChange={setThoughtText}
        onSubmit={handleSubmit}
        disabled={isSubmitting}
        onTagsDetected={handleTagsDetected}
      />

      <TagToggleList
        tags={tags}
        activeTags={detectedTags}
        thoughtText={thoughtText}
        onThoughtTextChange={setThoughtText}
      />
    </div>
  );
};

export default CaptureTab;
