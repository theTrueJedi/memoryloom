import React, { useState, useRef } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Thought, EmotionLabel } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useThoughts } from '../../hooks/useThoughts';
import { useTags } from '../../hooks/useTags';
import ThoughtTagSuggestions from './ThoughtTagSuggestions';
import RichTextEditor from '../Capture/RichTextEditor';
import TimestampEditor from './TimestampEditor';
import MoodSelector from './MoodSelector';
import {
  getSentimentColor,
  getSentimentEmoji,
} from '../../utils/sentimentUtils';

// Normalize HTML content to use consistent paragraph structure
const normalizeContent = (html: string): string => {
  // If content already has proper <p> tags (modern Quill format), return as-is
  if (html.includes('<p>')) {
    return html;
  }

  // For legacy content with <br> tags only, convert to paragraphs
  let normalized = html;

  // Convert double <br> to paragraph break
  normalized = normalized.replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '</p><p>');

  // Convert remaining single <br> to paragraph break (legacy format)
  normalized = normalized.replace(/<br\s*\/?>/gi, '</p><p>');

  // Wrap in paragraph tags if not already wrapped
  if (!normalized.startsWith('<p>')) {
    normalized = '<p>' + normalized;
  }
  if (!normalized.endsWith('</p>')) {
    normalized = normalized + '</p>';
  }

  // Clean up any empty paragraphs
  normalized = normalized.replace(/<p>\s*<\/p>/gi, '');

  return normalized || '<p></p>';
};

interface ThoughtCardProps {
  thought: Thought;
}

const ThoughtCard: React.FC<ThoughtCardProps> = ({ thought }) => {
  const { user } = useAuth();
  const { editThought, removeThought } = useThoughts(user?.uid);
  const { tags: allTags, addTag } = useTags(user?.uid);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [isEditingMood, setIsEditingMood] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(thought.tags);
  const [editedContent, setEditedContent] = useState(thought.content);
  const [newTagInput, setNewTagInput] = useState('');

  // Sync local state when thought.tags changes (e.g., from accepted suggestions)
  React.useEffect(() => {
    setSelectedTags(thought.tags);
  }, [thought.tags]);

  // Secret timestamp editor state
  const [isTimestampEditorOpen, setIsTimestampEditorOpen] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const lastClickTime = useRef<number>(0);

  // Copy feedback state
  const [showCopied, setShowCopied] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const copyMenuRef = useRef<HTMLDivElement>(null);

  const formatDate = (timestamp: any): string => {
    const date = timestamp.toDate();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const handleTagToggle = (tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName)
        ? prev.filter((t) => t !== tagName)
        : [...prev, tagName]
    );
  };

  const handleAddNewTag = async () => {
    const trimmedTag = newTagInput.trim();
    if (!trimmedTag) return;

    // Check if tag already exists
    const tagExists = allTags.some(
      (tag) => tag.name.toLowerCase() === trimmedTag.toLowerCase()
    );

    if (!tagExists && user?.uid) {
      // Create the new tag
      await addTag(trimmedTag);
    }

    // Add to selected tags if not already selected
    if (!selectedTags.includes(trimmedTag)) {
      setSelectedTags((prev) => [...prev, trimmedTag]);
    }

    setNewTagInput('');
  };

  const handleSaveTags = async () => {
    // Update tag usage counts for newly added tags
    const newTags = selectedTags.filter(tag => !thought.tags.includes(tag));
    if (newTags.length > 0 && user?.uid) {
      // Update usage for each new tag
      for (const tag of newTags) {
        await addTag(tag);
      }
    }

    await editThought(thought.id, { tags: selectedTags });
    setIsEditingTags(false);
    setNewTagInput('');
  };

  const handleCancelEdit = () => {
    setSelectedTags(thought.tags);
    setIsEditingTags(false);
    setNewTagInput('');
  };

  const handleSaveContent = async () => {
    // Trim only leading/trailing newlines, preserve internal whitespace for indentation
    const trimmedContent = editedContent.replace(/^[\r\n]+|[\r\n]+$/g, '');
    await editThought(thought.id, { content: trimmedContent });
    setIsEditingContent(false);
  };

  const handleCancelContentEdit = () => {
    setEditedContent(thought.content);
    setIsEditingContent(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddNewTag();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setNewTagInput('');
    }
  };

  // Secret click detection for timestamp editor
  const handleCardClick = (e: React.MouseEvent) => {
    // Only count clicks on the card itself, not on interactive elements
    const target = e.target as HTMLElement;
    const isInteractiveElement =
      target.tagName === 'BUTTON' ||
      target.tagName === 'INPUT' ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('.thought-tag') ||
      target.closest('.rich-text-editor');

    if (isInteractiveElement) {
      return;
    }

    const now = Date.now();
    const timeSinceLastClick = now - lastClickTime.current;

    // Reset counter if more than 500ms since last click
    if (timeSinceLastClick > 500) {
      setClickCount(1);
    } else {
      const newCount = clickCount + 1;
      setClickCount(newCount);

      // Trigger timestamp editor on 7th click
      if (newCount === 7) {
        setIsTimestampEditorOpen(true);
        setClickCount(0); // Reset counter
      }
    }

    lastClickTime.current = now;
  };

  // Save handler for timestamp editor
  const handleSaveTimestamp = async (newTimestamp: Timestamp) => {
    // Update both timestamp and createdAt fields
    await editThought(thought.id, {
      timestamp: newTimestamp,
      createdAt: newTimestamp,
    });
    setIsTimestampEditorOpen(false);
  };

  // Delete handler
  const handleDeleteThought = async () => {
    if (!window.confirm('Are you sure you want to delete this thought? This action cannot be undone.')) {
      return;
    }

    try {
      await removeThought(thought.id);
    } catch (error) {
      console.error('Error deleting thought:', error);
      alert('Failed to delete thought. Please try again.');
    }
  };

  // Copy handler - copies plain text content
  const handleCopyThought = async (includeMetadata: boolean) => {
    // Convert HTML to plain text, preserving line breaks
    let htmlContent = thought.content;
    // Quill uses <p><br></p> for blank lines - treat as paragraph break
    htmlContent = htmlContent.replace(/<p><br\s*\/?><\/p>/gi, '');
    // Each </p><p> is a paragraph break - double newline
    htmlContent = htmlContent.replace(/<\/p>\s*<p>/gi, '\n\n');
    // Single <br> within a paragraph is a line break
    htmlContent = htmlContent.replace(/<br\s*\/?>/gi, '\n');
    // Strip opening/closing p tags
    htmlContent = htmlContent.replace(/<\/?p>/gi, '');
    // Extract text content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const plainText = (tempDiv.textContent || tempDiv.innerText || '').trim();

    let textToCopy = plainText;

    if (includeMetadata) {
      const tags = thought.tags.map(t => `#${t}`).join(' ');
      const primaryMood = thought.sentiment.label.charAt(0).toUpperCase() + thought.sentiment.label.slice(1);
      const secondaryMood = thought.sentiment.secondaryLabel
        ? thought.sentiment.secondaryLabel.charAt(0).toUpperCase() + thought.sentiment.secondaryLabel.slice(1)
        : null;
      const moods = secondaryMood ? `${primaryMood} | ${secondaryMood}` : primaryMood;

      textToCopy += '\n---\n';
      if (tags) textToCopy += `Tags: ${tags}\n`;
      textToCopy += `Moods: ${moods}`;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      setShowCopied(true);
      setShowCopyMenu(false);
      setTimeout(() => setShowCopied(false), 1500);
    } catch (error) {
      console.error('Error copying thought:', error);
    }
  };

  // Close copy menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (copyMenuRef.current && !copyMenuRef.current.contains(event.target as Node)) {
        setShowCopyMenu(false);
      }
    };

    if (showCopyMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCopyMenu]);

  // Mood change handlers
  const handleSaveMood = async (primary: EmotionLabel, secondary?: EmotionLabel) => {
    const updatedSentiment = {
      ...thought.sentiment,
      label: primary,
      secondaryLabel: secondary,
    };
    await editThought(thought.id, { sentiment: updatedSentiment });
    setIsEditingMood(false);
  };

  const handleCancelMoodEdit = () => {
    setIsEditingMood(false);
  };

  return (
    <div className="thought-card" onClick={handleCardClick}>
      <div className="thought-card-top">
        <div className="thought-card-tags">
          {selectedTags.length > 0 && !isEditingTags && (
            <div className="thought-tags">
              {selectedTags.map((tag) => (
                <span
                  key={tag}
                  className="thought-tag"
                  onClick={() => setIsEditingTags(true)}
                  title="Click to edit tags"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="thought-card-meta">
          <span className="thought-date">{formatDate(thought.timestamp)}</span>
          <div className="sentiment-indicators">
            <div
              className="sentiment-indicator primary"
              style={{ backgroundColor: getSentimentColor(thought.sentiment.label) }}
              title={thought.sentiment.label === 'processing'
                ? 'Processing Sentiment...'
                : `Primary: ${thought.sentiment.label.charAt(0).toUpperCase() + thought.sentiment.label.slice(1)} (${thought.sentiment.score.toFixed(2)})`}
            >
              {getSentimentEmoji(thought.sentiment.label)}
            </div>
            {thought.sentiment.secondaryLabel && (
              <div
                className="sentiment-indicator secondary"
                style={{ backgroundColor: getSentimentColor(thought.sentiment.secondaryLabel) }}
                title={`Secondary: ${thought.sentiment.secondaryLabel.charAt(0).toUpperCase() + thought.sentiment.secondaryLabel.slice(1)}`}
              >
                {getSentimentEmoji(thought.sentiment.secondaryLabel)}
              </div>
            )}
          </div>
        </div>
      </div>

      {!isEditingContent ? (
        <div
          className="thought-content"
          dangerouslySetInnerHTML={{ __html: normalizeContent(thought.content) }}
        />
      ) : (
        <div className="thought-content-editor">
          <RichTextEditor
            value={editedContent}
            onChange={setEditedContent}
            placeholder="Edit your thought..."
            minHeight="100px"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                handleCancelContentEdit();
              }
            }}
          />
          <div className="thought-content-actions">
            <button className="button-accept" onClick={handleSaveContent}>
              Save
            </button>
            <button className="button-reject" onClick={handleCancelContentEdit}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <ThoughtTagSuggestions thoughtId={thought.id} />

      <div className="thought-tags-section">
        {!isEditingTags && !isEditingContent && !isEditingMood ? (
          <>
            <div className="thought-action-buttons-left">
              <span className="edit-label">Edit:</span>
              <button
                className="edit-tags-button"
                onClick={() => setIsEditingContent(true)}
              >
                Content
              </button>
              <button
                className="edit-tags-button"
                onClick={() => setIsEditingTags(true)}
              >
                Tags
              </button>
              <button
                className="edit-tags-button"
                onClick={() => setIsEditingMood(true)}
              >
                Moods
              </button>
            </div>
            <div className="thought-action-buttons-right">
              <div className="copy-button-wrapper" ref={copyMenuRef}>
                <button
                  className="copy-button"
                  onClick={() => setShowCopyMenu(!showCopyMenu)}
                  title="Copy thought"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
                {showCopyMenu && (
                  <div className="copy-menu">
                    <button onClick={() => handleCopyThought(false)}>Copy Thought only</button>
                    <button onClick={() => handleCopyThought(true)}>Copy Thought, Tags & Moods</button>
                  </div>
                )}
                {showCopied && <span className="copied-tooltip">Copied!</span>}
              </div>
              <button
                className="delete-button"
                onClick={handleDeleteThought}
                title="Delete thought"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            </div>
          </>
        ) : isEditingTags ? (
          <div
            className="tag-editor"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                handleCancelEdit();
              }
            }}
          >
            <div className="tag-editor-new-tag">
              <div className="tag-editor-input-wrapper">
                <span className="tag-editor-hash">#</span>
                <input
                  type="text"
                  className="tag-editor-input"
                  placeholder="Add new tag..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                />
              </div>
              <button
                className="tag-editor-add-button"
                onClick={handleAddNewTag}
                disabled={!newTagInput.trim()}
              >
                Add
              </button>
            </div>
            <div className="tag-editor-grid">
              {allTags.map((tag) => (
                <button
                  key={tag.name}
                  className={`tag-editor-item ${
                    selectedTags.includes(tag.name) ? 'active' : ''
                  }`}
                  onClick={() => handleTagToggle(tag.name)}
                >
                  <span className="tag-name">{tag.name}</span>
                  <span className="tag-checkmark">
                    {selectedTags.includes(tag.name) ? '✓' : '+'}
                  </span>
                </button>
              ))}
            </div>
            <div className="tag-editor-actions">
              <button className="button-accept" onClick={handleSaveTags}>
                Save
              </button>
              <button className="button-reject" onClick={handleCancelEdit}>
                Cancel
              </button>
            </div>
          </div>
        ) : isEditingMood ? (
          <MoodSelector
            currentPrimary={thought.sentiment.label}
            currentSecondary={thought.sentiment.secondaryLabel}
            onSave={handleSaveMood}
            onCancel={handleCancelMoodEdit}
          />
        ) : null}
      </div>

      <TimestampEditor
        thought={thought}
        isOpen={isTimestampEditorOpen}
        onClose={() => setIsTimestampEditorOpen(false)}
        onSave={handleSaveTimestamp}
      />
    </div>
  );
};

export default ThoughtCard;
