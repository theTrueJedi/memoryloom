import React, { useState } from 'react';
import { Tag } from '../../types';

interface TagListProps {
  tags: Tag[];
  selectedTag: string | null;
  onTagSelect: (tag: string | null) => void;
}

const TagList: React.FC<TagListProps> = ({ tags, selectedTag, onTagSelect }) => {
  const [expanded, setExpanded] = useState(false);

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="tag-list-section">
      <h3 className="section-title">Trace by Tag</h3>
      <div className={`tag-list ${expanded ? '' : 'collapsed'}`}>
        <button
          className={`tag-filter ${selectedTag === null ? 'active' : ''}`}
          onClick={() => onTagSelect(null)}
        >
          All Thoughts
        </button>
        {tags.map((tag) => (
          <button
            key={tag.id}
            className={`tag-filter ${selectedTag === tag.name ? 'active' : ''}`}
            onClick={() => onTagSelect(tag.name)}
          >
            <span className="tag-name">#{tag.name}</span>
            <span className="tag-badge">{tag.usageCount}</span>
          </button>
        ))}
      </div>
      <button
        className="expand-tags-button"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Collapse' : 'Expand...'}
      </button>
    </div>
  );
};

export default TagList;
