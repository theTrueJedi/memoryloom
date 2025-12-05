import React, { useState, useRef } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Thought } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useThoughts } from '../../hooks/useThoughts';
import { useTags } from '../../hooks/useTags';
import ThoughtTagSuggestions from './ThoughtTagSuggestions';
import RichTextEditor from '../Capture/RichTextEditor';
import TimestampEditor from './TimestampEditor';

interface ThoughtCardProps {
  thought: Thought;
}

const ThoughtCard: React.FC<ThoughtCardProps> = ({ thought }) => {
  const { user } = useAuth();
  const { editThought } = useThoughts(user?.uid);
  const { tags: allTags, addTag } = useTags(user?.uid);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(thought.tags);
  const [editedContent, setEditedContent] = useState(thought.content);
  const [newTagInput, setNewTagInput] = useState('');

  // Secret timestamp editor state
  const [isTimestampEditorOpen, setIsTimestampEditorOpen] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const lastClickTime = useRef<number>(0);

  const getSentimentColor = (label: string): string => {
    switch (label) {
      // Positive emotions - greens and warm colors
      case 'joy':
        return '#4CAF50';
      case 'gratitude':
        return '#8BC34A';
      case 'pride':
        return '#FFC107';
      case 'excitement':
        return '#FF9800';
      case 'love':
        return '#E91E63';
      case 'peace':
        return '#00BCD4';
      case 'hope':
        return '#03A9F4';
      case 'curiosity':
        return '#9C27B0';
      case 'surprise':
        return '#FF6F00';

      // Negative emotions - reds, blues, and grays
      case 'sadness':
        return '#5C6BC0';
      case 'anxiety':
        return '#FF5722';
      case 'anger':
        return '#F44336';
      case 'fear':
        return '#9E9E9E';
      case 'shame':
        return '#795548';
      case 'loneliness':
        return '#607D8B';
      case 'disappointment':
        return '#757575';
      case 'boredom':
        return '#9E9E9E';

      // Neutral/Other
      case 'confusion':
        return '#FF9800';
      case 'neutral':
        return '#9E9E9E';
      case 'mixed':
        return '#673AB7';

      default:
        return '#9E9E9E';
    }
  };

  const getSentimentEmoji = (label: string): string => {
    switch (label) {
      // Positive emotions
      case 'joy':
        return '😊';
      case 'gratitude':
        return '🙏';
      case 'pride':
        return '🌟';
      case 'excitement':
        return '🎉';
      case 'love':
        return '❤️';
      case 'peace':
        return '☮️';
      case 'hope':
        return '🌅';
      case 'curiosity':
        return '🤔';
      case 'surprise':
        return '😲';

      // Negative emotions
      case 'sadness':
        return '😢';
      case 'anxiety':
        return '😰';
      case 'anger':
        return '😤';
      case 'fear':
        return '😨';
      case 'shame':
        return '😳';
      case 'loneliness':
        return '😔';
      case 'disappointment':
        return '😞';
      case 'boredom':
        return '😑';

      // Neutral/Other
      case 'confusion':
        return '😕';
      case 'neutral':
        return '😌';
      case 'mixed':
        return '😐';

      default:
        return '😌';
    }
  };

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
    await editThought(thought.id, { content: editedContent.trim() });
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
              title={`Primary: ${thought.sentiment.label} (${thought.sentiment.score.toFixed(2)})`}
            >
              {getSentimentEmoji(thought.sentiment.label)}
            </div>
            {thought.sentiment.secondaryLabel && (
              <div
                className="sentiment-indicator secondary"
                style={{ backgroundColor: getSentimentColor(thought.sentiment.secondaryLabel) }}
                title={`Secondary: ${thought.sentiment.secondaryLabel}`}
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
          dangerouslySetInnerHTML={{ __html: thought.content }}
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
        {!isEditingTags && !isEditingContent ? (
          <>
            <button
              className="edit-tags-button"
              onClick={() => setIsEditingContent(true)}
            >
              Edit
            </button>
            <button
              className="edit-tags-button"
              onClick={() => setIsEditingTags(true)}
            >
              {selectedTags.length > 0 ? 'Change Tags' : 'Add Tags'}
            </button>
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
