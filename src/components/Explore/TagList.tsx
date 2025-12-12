import React, { useState, useRef, useEffect } from 'react';
import { Tag } from '../../types';

interface TagListProps {
  tags: Tag[];
  selectedTags: string[];
  onTagToggle: (tag: string | null) => void;
  onSpinYarn?: () => void;
}

const COLLAPSED_MAX_HEIGHT = 102; // ~3 rows: 3 * 30px tag height + 2 * 6px gaps

const TagList: React.FC<TagListProps> = ({ tags, selectedTags, onTagToggle, onSpinYarn }) => {
  const [expanded, setExpanded] = useState(false);
  const [needsExpand, setNeedsExpand] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      setNeedsExpand(containerRef.current.scrollHeight > COLLAPSED_MAX_HEIGHT);
    }
  }, [tags]);

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="tag-list-section">
      <h3 className="section-title">Trace by Tag</h3>
      <div ref={containerRef} className={`tag-list ${expanded ? '' : 'collapsed'}`}>
        <button
          className={`tag-filter ${selectedTags.length === 0 ? 'active' : ''}`}
          onClick={() => onTagToggle(null)}
        >
          All Thoughts
        </button>
        {tags.map((tag) => (
          <button
            key={tag.id}
            className={`tag-filter ${selectedTags.includes(tag.name) ? 'active' : ''}`}
            onClick={() => onTagToggle(tag.name)}
          >
            <span className="tag-name">#{tag.name}</span>
            <span className="tag-badge">{tag.usageCount}</span>
          </button>
        ))}
      </div>
      {needsExpand && (
        <button
          className="expand-tags-button"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Collapse' : 'Expand...'}
        </button>
      )}
      {onSpinYarn && (
        <div className="spin-yarn-row">
          <span className={`spin-yarn-hint ${selectedTags.length === 1 ? 'hidden' : ''}`}>
            Select a single Tag to...
          </span>
          <button
            className={`spin-yarn-button ${selectedTags.length !== 1 ? 'disabled' : ''}`}
            onClick={onSpinYarn}
            disabled={selectedTags.length !== 1}
          >
            Spin a Yarn for #{selectedTags.length === 1 ? selectedTags[0] : '____'}
          </button>
        </div>
      )}
    </div>
  );
};

export default TagList;
