import React, { useEffect } from 'react';
import { extractTags } from '../../services/tagExtraction';
import RichTextEditor from './RichTextEditor';

interface ThoughtInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  onTagsDetected: (tags: string[]) => void;
  availableTags?: string[]; // Tags available for autocomplete
  draftStatus?: {
    hasDraft: boolean;
    lastSaved: Date | null;
  };
}

const ThoughtInput: React.FC<ThoughtInputProps> = ({
  value,
  onChange,
  onSubmit,
  disabled = false,
  onTagsDetected,
  availableTags = [],
  draftStatus,
}) => {
  useEffect(() => {
    // Extract and notify parent of tags whenever content changes
    // Strip HTML tags before extracting hashtags
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = value;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    const tags = extractTags(plainText);
    onTagsDetected(tags);
  }, [value, onTagsDetected]);

  const handleKeyDown = (e: any) => {
    // Submit on Cmd+Enter or Ctrl+Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="thought-input-container">
      <RichTextEditor
        value={value}
        onChange={onChange}
        placeholder="What's on your mind? Use #tags to categorize your thoughts..."
        disabled={disabled}
        minHeight="100px"
        onKeyDown={handleKeyDown}
        tags={availableTags}
      />
      <div className="thought-input-footer">
        <div className="hint-section">
          {draftStatus?.hasDraft && draftStatus.lastSaved && (
            <span className="draft-status">
              Draft saved {draftStatus.lastSaved.toLocaleTimeString()}
            </span>
          )}
          <span className="hint-text">
            Tip: Press Cmd+Enter to save
          </span>
        </div>
        <button
          className="button-primary submit-button"
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
        >
          {disabled ? 'Saving...' : 'Save Thought'}
        </button>
      </div>
    </div>
  );
};

export default ThoughtInput;
