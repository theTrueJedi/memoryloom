import React, { useMemo } from 'react';
import { Thought, EmotionLabel } from '../../types';

interface MoodVisualizationProps {
  thoughts: Thought[];
}

interface MoodCount {
  label: EmotionLabel;
  count: number;
  emoji: string;
  color: string;
}

interface WordData {
  text: string;
  value: number;
  color: string;
}

const MoodVisualization: React.FC<MoodVisualizationProps> = ({ thoughts }) => {
  const getSentimentEmoji = (label: EmotionLabel): string => {
    const emojiMap: Record<EmotionLabel, string> = {
      joy: '😄',
      amusement: '😂',
      gratitude: '🙏',
      pride: '🌟',
      excitement: '🎉',
      love: '❤️',
      peace: '☮️',
      hope: '🌅',
      curiosity: '🤔',
      surprise: '😲',
      sadness: '😢',
      anxiety: '😰',
      anger: '😡',
      fear: '😨',
      shame: '😳',
      loneliness: '😔',
      disappointment: '😞',
      boredom: '😑',
      confusion: '😕',
      neutral: '😌',
      mixed: '😐',
    };
    return emojiMap[label];
  };

  const getSentimentColor = (label: EmotionLabel): string => {
    const colorMap: Record<EmotionLabel, string> = {
      joy: '#46a050',
      amusement: '#F28500',
      gratitude: '#8BC34A',
      pride: '#FFC107',
      excitement: '#FF9800',
      love: '#df58b4',
      peace: '#328cb3',
      hope: '#54b9e8',
      curiosity: '#9227b0',
      surprise: '#ff8800',
      sadness: '#4e61ca',
      anxiety: '#f44e4e',
      anger: '#ba261c',
      fear: '#4b4949',
      shame: '#a16059',
      loneliness: '#557d91',
      disappointment: '#716496',
      boredom: '#819c77',
      confusion: '#FF9800',
      neutral: '#949494',
      mixed: '#673AB7',
    };
    return colorMap[label];
  };

  const moodCounts = useMemo(() => {
    const counts = new Map<EmotionLabel, number>();

    thoughts.forEach((thought) => {
      // Primary sentiment gets full weight (1.0)
      const primaryLabel = thought.sentiment.label;
      counts.set(primaryLabel, (counts.get(primaryLabel) || 0) + 1);

      // Secondary sentiment gets 60% weight (0.6)
      if (thought.sentiment.secondaryLabel) {
        const secondaryLabel = thought.sentiment.secondaryLabel;
        counts.set(secondaryLabel, (counts.get(secondaryLabel) || 0) + 0.6);
      }
    });

    const moodData: MoodCount[] = Array.from(counts.entries()).map(([label, count]) => ({
      label,
      count,
      emoji: getSentimentEmoji(label),
      color: getSentimentColor(label),
    }));

    moodData.sort((a, b) => b.count - a.count);

    return moodData;
  }, [thoughts]);

  const wordCloudData: WordData[] = useMemo(() => {
    return moodCounts.map((mood) => ({
      text: `${mood.emoji} ${mood.label.charAt(0).toUpperCase() + mood.label.slice(1)}`,
      value: mood.count,
      color: mood.color,
    }));
  }, [moodCounts]);

  const maxCount = Math.max(...moodCounts.map((m) => m.count), 1);
  const totalCount = thoughts.length;

  if (thoughts.length === 0) {
    return (
      <div className="mood-visualization empty">
        <p className="empty-message">No thoughts in this date range</p>
      </div>
    );
  }

  const getFontSize = (count: number): number => {
    const minSize = 14;
    const maxSize = 42;
    const ratio = count / maxCount;
    return minSize + (maxSize - minSize) * ratio;
  };

  const getRotation = (): number => {
    const rotations = [0, -15, 15, -30, 30, -45, 45];
    return rotations[Math.floor(Math.random() * rotations.length)];
  };

  return (
    <div className="mood-visualization">
      <h3 className="visualization-title">Mood Overview</h3>
      <div className="mood-cloud-container">
        {wordCloudData.map((word, index) => {
          const percentage = ((word.value / totalCount) * 100).toFixed(1);
          return (
            <span
              key={word.text}
              className="mood-cloud-word"
              style={{
                fontSize: `${getFontSize(word.value)}pt`,
                color: word.color,
                transform: `rotate(${getRotation()}deg)`,
                animationDelay: `${index * 0.1}s`,
              }}
              title={`${word.text}: ${word.value} thoughts (${percentage}%)`}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default MoodVisualization;
