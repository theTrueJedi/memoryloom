import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useThoughts } from '../../hooks/useThoughts';
import { useTags } from '../../hooks/useTags';
import { useDraft } from '../../hooks/useDraft';
import ThoughtInput from './ThoughtInput';
import TagToggleList from './TagToggleList';
import { processThought } from '../../services/gemini';
import { createTagSuggestion } from '../../services/firestore';
import { stripTags } from '../../services/tagExtraction';
import { Sentiment } from '../../types';

const CaptureTab: React.FC = () => {
  const { user } = useAuth();
  const { addThought, thoughts } = useThoughts(user?.uid);
  const { tags } = useTags(user?.uid);

  // Auto-save drafts with 300ms debounce (proven timing from modernsalon)
  const {
    draftContent,
    draftTags,
    setDraftContent,
    setDraftTags,
    clearDraft,
    isLoading: isDraftLoading,
    hasDraft,
    lastSaved,
  } = useDraft(user?.uid, 'capture-thought');

  const [thoughtText, setThoughtText] = useState('');
  const [detectedTags, setDetectedTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize from draft on load
  useEffect(() => {
    if (!isDraftLoading && draftContent) {
      setThoughtText(draftContent);
      setDetectedTags(draftTags);
    }
  }, [isDraftLoading, draftContent, draftTags]);

  // Sync local state to draft (debounced by the hook)
  const handleTextChange = useCallback((text: string) => {
    setThoughtText(text);
    setDraftContent(text);
  }, [setDraftContent]);

  const handleTagsDetected = useCallback((newTags: string[]) => {
    setDetectedTags(newTags);
    setDraftTags(newTags);
  }, [setDraftTags]);

  const handleSubmit = async () => {
    if (!thoughtText.trim() || !user) return;

    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      // Strip hashtags from the content before saving
      const contentWithoutTags = stripTags(thoughtText);

      // Create 'processing' sentiment - will be updated asynchronously
      const processingSentiment: Sentiment = {
        score: 0,
        magnitude: 0,
        label: 'processing',
      };

      // Save thought immediately with 'processing' sentiment
      const thoughtId = await addThought(contentWithoutTags, detectedTags, processingSentiment);

      if (thoughtId) {
        // Clear form, draft, and show success message immediately
        const savedThoughtText = thoughtText; // Capture for async processing
        const savedDetectedTags = [...detectedTags];
        setThoughtText('');
        setDetectedTags([]);
        await clearDraft();
        setSuccessMessage('Thought saved successfully!');

        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(null), 3000);

        // Process sentiment and tags asynchronously (don't await)
        // The Cloud Function will update Firestore directly with the sentiment
        if (user.uid) {
          processThoughtAsync(user.uid, thoughtId, savedThoughtText, tags.map(t => t.name), savedDetectedTags)
            .catch(err => console.error('Error processing thought:', err));
        }
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

  const processThoughtAsync = async (
    userId: string,
    thoughtId: string,
    content: string,
    existingTagNames: string[],
    alreadyAppliedTags: string[]
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

      // Call the combined Cloud Function - it updates sentiment in Firestore
      // and returns tag suggestions
      const result = await processThought(
        thoughtId,
        userId,
        content,
        existingTagNames,
        context
      );

      // Handle tag suggestions from the response
      const { tagSuggestions } = result;

      // Create suggestion for existing tags
      for (const tag of tagSuggestions.existingTags) {
        if (!alreadyAppliedTags.includes(tag)) {
          await createTagSuggestion(
            userId,
            thoughtId,
            tag,
            false,
            `AI suggested existing tag: ${tagSuggestions.reasoning}`
          );
        }
      }

      // Create suggestion for new tag
      if (tagSuggestions.newTag && !alreadyAppliedTags.includes(tagSuggestions.newTag)) {
        await createTagSuggestion(
          userId,
          thoughtId,
          tagSuggestions.newTag,
          true,
          `AI suggested new tag: ${tagSuggestions.reasoning}`
        );
      }
    } catch (error) {
      console.error('Error in processThoughtAsync:', error);
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
        onChange={handleTextChange}
        onSubmit={handleSubmit}
        disabled={isSubmitting || isDraftLoading}
        onTagsDetected={handleTagsDetected}
        availableTags={tags.map(t => t.name)}
        draftStatus={{ hasDraft, lastSaved }}
      />

      <TagToggleList
        tags={tags}
        activeTags={detectedTags}
        thoughtText={thoughtText}
        onThoughtTextChange={handleTextChange}
      />
    </div>
  );
};

export default CaptureTab;
