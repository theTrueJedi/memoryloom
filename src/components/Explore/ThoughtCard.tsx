import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Thought } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useThoughts } from '../../hooks/useThoughts';
import { useTags } from '../../hooks/useTags';
import ThoughtTagSuggestions from './ThoughtTagSuggestions';

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

  const getSentimentColor = (label: string): string => {
    switch (label) {
      case 'positive':
        return '#4CAF50';
      case 'negative':
        return '#F44336';
      case 'mixed':
        return '#FF9800';
      default:
        return '#9E9E9E';
    }
  };

  const getSentimentEmoji = (label: string): string => {
    switch (label) {
      case 'positive':
        return '😊';
      case 'negative':
        return '😔';
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

  return (
    <div className="thought-card">
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
          <div
            className="sentiment-indicator"
            style={{ backgroundColor: getSentimentColor(thought.sentiment.label) }}
            title={`Sentiment: ${thought.sentiment.label} (${thought.sentiment.score.toFixed(2)})`}
          >
            {getSentimentEmoji(thought.sentiment.label)}
          </div>
        </div>
      </div>

      {!isEditingContent ? (
        <div className="thought-content">
          <ReactMarkdown>
            {thought.content
              .replace(/\*\*([^*]+)\*\*/g, '___DOUBLE___$1___DOUBLE___')
              .replace(/\*([^*]+)\*/g, '**$1**')
              .replace(/___DOUBLE___([^_]+)___DOUBLE___/g, '_$1_')
            }
          </ReactMarkdown>
        </div>
      ) : (
        <div className="thought-content-editor">
          <textarea
            className="thought-content-textarea"
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            autoFocus
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
    </div>
  );
};

export default ThoughtCard;
