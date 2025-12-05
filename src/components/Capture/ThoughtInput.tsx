import React, { useRef, useEffect } from 'react';
import { extractTags } from '../../services/tagExtraction';

interface ThoughtInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  onTagsDetected: (tags: string[]) => void;
}

const ThoughtInput: React.FC<ThoughtInputProps> = ({
  value,
  onChange,
  onSubmit,
  disabled = false,
  onTagsDetected,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Extract and notify parent of tags whenever content changes
    const tags = extractTags(value);
    onTagsDetected(tags);
  }, [value, onTagsDetected]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Cmd+Enter or Ctrl+Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="thought-input-container">
      <textarea
        ref={textareaRef}
        className="thought-input"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="What's on your mind? Use #tags to categorize your thoughts..."
        disabled={disabled}
        rows={8}
      />
      <div className="thought-input-footer">
        <span className="hint-text">
          Tip: Press Cmd+Enter to save
        </span>
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
