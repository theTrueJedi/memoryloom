import React, { useMemo } from 'react';
import { Thought } from '../../types';

interface TagCloudVisualizationProps {
  thoughts: Thought[];
}

interface TagCount {
  tag: string;
  count: number;
}

interface WordData {
  text: string;
  value: number;
  color: string;
}

const TagCloudVisualization: React.FC<TagCloudVisualizationProps> = ({ thoughts }) => {
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();

    thoughts.forEach((thought) => {
      thought.tags.forEach((tag) => {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      });
    });

    const tagData: TagCount[] = Array.from(counts.entries()).map(([tag, count]) => ({
      tag,
      count,
    }));

    tagData.sort((a, b) => b.count - a.count);

    return tagData;
  }, [thoughts]);

  const getTagColor = (tag: string): string => {
    const colors = [
      '#4CAF50', '#2196F3', '#9C27B0', '#FF9800',
      '#E91E63', '#00BCD4', '#8BC34A', '#FFC107',
      '#673AB7', '#FF5722', '#03A9F4', '#CDDC39',
    ];

    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const wordCloudData: WordData[] = useMemo(() => {
    return tagCounts.map((tagData) => ({
      text: `#${tagData.tag}`,
      value: tagData.count,
      color: getTagColor(tagData.tag),
    }));
  }, [tagCounts]);

  const maxCount = Math.max(...tagCounts.map((t) => t.count), 1);
  const totalTags = tagCounts.reduce((sum, t) => sum + t.count, 0);

  if (tagCounts.length === 0) {
    return (
      <div className="tag-cloud-visualization empty">
        <p className="empty-message">No tags in this date range</p>
      </div>
    );
  }

  const getFontSize = (count: number): number => {
    const minSize = 12;
    const maxSize = 36;
    const ratio = count / maxCount;
    return minSize + (maxSize - minSize) * ratio;
  };

  const getRotation = (): number => {
    const rotations = [0, -15, 15, -30, 30, -45, 45];
    return rotations[Math.floor(Math.random() * rotations.length)];
  };

  return (
    <div className="tag-cloud-visualization">
      <h3 className="visualization-title">Tag Cloud</h3>
      <div className="tag-cloud-container">
        {wordCloudData.map((word, index) => {
          const percentage = ((word.value / totalTags) * 100).toFixed(1);
          return (
            <span
              key={word.text}
              className="tag-cloud-word"
              style={{
                fontSize: `${getFontSize(word.value)}pt`,
                color: word.color,
                transform: `rotate(${getRotation()}deg)`,
                animationDelay: `${index * 0.1}s`,
              }}
              title={`${word.text}: ${word.value} occurrences (${percentage}%)`}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default TagCloudVisualization;
