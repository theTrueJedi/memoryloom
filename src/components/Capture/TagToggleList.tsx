import React from 'react';
import { Tag } from '../../types';
import { insertTag, removeTag } from '../../services/tagExtraction';

interface TagToggleListProps {
  tags: Tag[];
  activeTags: string[];
  thoughtText: string;
  onThoughtTextChange: (text: string) => void;
}

const TagToggleList: React.FC<TagToggleListProps> = ({
  tags,
  activeTags,
  thoughtText,
  onThoughtTextChange,
}) => {
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
      <h3 className="tag-toggle-title">Your Tags</h3>
      <div className="tag-toggle-grid">
        {tags.map((tag) => {
          const isActive = activeTags.includes(tag.name);
          return (
            <button
              key={tag.id}
              className={`tag-toggle ${isActive ? 'active' : ''}`}
              onClick={() => handleTagToggle(tag.name)}
            >
              <span className="tag-name">#{tag.name}</span>
              <span className="tag-count">{tag.usageCount}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TagToggleList;
