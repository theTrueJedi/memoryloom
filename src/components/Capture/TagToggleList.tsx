import React, { useState, useRef, useEffect } from 'react';
import { Tag } from '../../types';
import { insertTag, removeTag } from '../../services/tagExtraction';

interface TagToggleListProps {
  tags: Tag[];
  activeTags: string[];
  thoughtText: string;
  onThoughtTextChange: (text: string) => void;
}

const COLLAPSED_MAX_HEIGHT = 102; // ~3 rows: 3 * 30px tag height + 2 * 6px gaps

const TagToggleList: React.FC<TagToggleListProps> = ({
  tags,
  activeTags,
  thoughtText,
  onThoughtTextChange,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [needsExpand, setNeedsExpand] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      setNeedsExpand(containerRef.current.scrollHeight > COLLAPSED_MAX_HEIGHT);
    }
  }, [tags]);

  const handleTagToggle = (tagName: string) => {
    const isActive = activeTags.includes(tagName);

    if (isActive) {
      // Remove tag from text
      const newText = removeTag(thoughtText, tagName);
      onThoughtTextChange(newText);
    } else {
      // Add tag to text at the end
      const { newText } = insertTag(thoughtText, thoughtText.length, tagName);
      onThoughtTextChange(newText);
    }
  };

  if (tags.length === 0) {
    return (
      <div className="tag-toggle-list">
        <p className="empty-state">
          No tags yet. Start using #tags in your thoughts to create them!
        </p>
      </div>
    );
  }

  return (
    <div className="tag-toggle-list">
      <h3 className="tag-toggle-title">Add Past Tags</h3>
      <div ref={containerRef} className={`tag-toggle-grid ${expanded ? '' : 'collapsed'}`}>
        {tags.map((tag) => {
          const isActive = activeTags.includes(tag.name);
          return (
            <button
              key={tag.id}
              className={`tag-toggle ${isActive ? 'active' : ''}`}
              onClick={() => handleTagToggle(tag.name)}
            >
              <span className="tag-name">#{tag.name}</span>
            </button>
          );
        })}
      </div>
      {needsExpand && (
        <button
          className="expand-tags-button"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Collapse' : 'Expand...'}
        </button>
      )}
    </div>
  );
};

export default TagToggleList;
