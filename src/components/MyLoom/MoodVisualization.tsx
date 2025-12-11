import React, { useMemo, useRef, useEffect, useState } from 'react';
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

interface PositionedWord extends WordData {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fontSize: number;
  fontWeight: number;
}

const MoodVisualization: React.FC<MoodVisualizationProps> = ({ thoughts }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [positionedWords, setPositionedWords] = useState<PositionedWord[]>([]);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 400, offsetX: 0, offsetY: 0 });

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
      creative: '🎨',
      curiosity: '🤔',
      surprise: '😲',
      sadness: '😢',
      anxiety: '😰',
      frustration: '😤',
      anger: '😡',
      fear: '😨',
      shame: '😳',
      loneliness: '😔',
      disappointment: '😞',
      boredom: '😑',
      confusion: '😕',
      neutral: '😌',
      mixed: '😐',
      processing: '🕐',
    };
    return emojiMap[label];
  };

  const getSentimentColor = (label: EmotionLabel): string => {
    const colorMap: Record<EmotionLabel, string> = {
      joy: '#3f9749',
      amusement: '#F28500',
      gratitude: '#8BC34A',
      pride: '#FFC107',
      excitement: '#FF9800',
      love: '#df58b4',
      peace: '#328cb3',
      hope: '#54b9e8',
      creative: '#79d29e',
      curiosity: '#9227b0',
      surprise: '#ff8800',
      sadness: '#4e61ca',
      anxiety: '#f44e4e',
      frustration: '#c86aaf',
      anger: '#ba261c',
      fear: '#4b4949',
      shame: '#a16059',
      loneliness: '#557d91',
      disappointment: '#716496',
      boredom: '#819c77',
      confusion: '#FF9800',
      neutral: '#949494',
      mixed: '#673AB7',
      processing: '#d0d0d0',
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
  const minCount = Math.min(...moodCounts.map((m) => m.count), 1);
  const totalCount = thoughts.length;

  if (thoughts.length === 0) {
    return (
      <div className="mood-visualization empty">
        <p className="empty-message">No thoughts in this date range</p>
      </div>
    );
  }

  const getFontSize = (count: number, containerWidth: number): number => {
    const isSmallScreen = containerWidth < 500;
    const minSize = isSmallScreen ? 10 : 14;
    const maxSize = isSmallScreen ? 32 : 48;
    // Use relative scaling: smallest count maps to 0, largest to 1
    const range = maxCount - minCount;
    const ratio = range > 0 ? (count - minCount) / range : 1;
    // Use power scaling for more dramatic size differences
    return minSize + (maxSize - minSize) * Math.pow(ratio, 0.7);
  };

  const getFontWeight = (count: number): number => {
    // Use relative scaling: smallest count maps to 0, largest to 1
    const range = maxCount - minCount;
    const ratio = range > 0 ? (count - minCount) / range : 1;
    // More granular font weight distribution for better visual hierarchy
    if (ratio >= 0.9) return 900;
    if (ratio >= 0.75) return 800;
    if (ratio >= 0.6) return 700;
    if (ratio >= 0.45) return 600;
    if (ratio >= 0.3) return 500;
    if (ratio >= 0.15) return 400;
    return 300;
  };

  // Estimate word dimensions based on font size and text length
  const estimateWordDimensions = (text: string, fontSize: number, rotation: number) => {
    // Account for CSS padding (4px 8px)
    const paddingX = 16; // 8px * 2
    const paddingY = 8;  // 4px * 2

    // Font size in pt needs conversion to px (1pt ≈ 1.333px)
    const fontSizePx = fontSize * 1.333;

    // Tighter character width for better packing (emojis are wider)
    const avgCharWidth = fontSizePx * 0.6; // Slightly wider for emojis
    const baseWidth = text.length * avgCharWidth + paddingX;
    const baseHeight = fontSizePx + paddingY;

    // Swap dimensions for vertical text
    if (Math.abs(rotation) === 90) {
      return { width: baseHeight, height: baseWidth };
    }

    return { width: baseWidth, height: baseHeight };
  };

  // Check if two rectangles overlap with padding
  const checkOverlap = (rect1: any, rect2: any, padding = 2) => {
    return !(
      rect1.x + rect1.width + padding < rect2.x ||
      rect2.x + rect2.width + padding < rect1.x ||
      rect1.y + rect1.height + padding < rect2.y ||
      rect2.y + rect2.height + padding < rect1.y
    );
  };

  // Spiral search for word placement
  const findPosition = (
    word: WordData,
    fontSize: number,
    rotation: number,
    placedWords: PositionedWord[],
    containerWidth: number,
    containerHeight: number,
    wordIndex: number,
    totalWords: number
  ): { x: number; y: number } | null => {
    const dims = estimateWordDimensions(word.text, fontSize, rotation);
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;

    // Try center first
    let testPos = {
      x: centerX - dims.width / 2,
      y: centerY - dims.height / 2,
      width: dims.width,
      height: dims.height
    };

    let hasOverlap = placedWords.some(placed => checkOverlap(testPos, placed));
    if (!hasOverlap && testPos.x >= 0 && testPos.y >= 0 &&
        testPos.x + dims.width <= containerWidth && testPos.y + dims.height <= containerHeight) {
      return { x: testPos.x, y: testPos.y };
    }

    // Adaptive spiral parameters based on word prominence
    const prominence = 1 - (wordIndex / totalWords);

    // Smaller words get more aggressive search
    const angleStep = 0.05 + (prominence * 0.1);

    // Smaller words start searching from slightly further out to find gaps
    const startRadius = prominence < 0.3 ? 20 : 0;

    const radiusStep = 1.2;

    let angle = 0;
    let radius = startRadius;
    const maxRadius = Math.max(containerWidth, containerHeight) * 0.85;

    while (radius < maxRadius) {
      const x = centerX + radius * Math.cos(angle) - dims.width / 2;
      const y = centerY + radius * Math.sin(angle) - dims.height / 2;

      testPos = { x, y, width: dims.width, height: dims.height };

      hasOverlap = placedWords.some(placed => checkOverlap(testPos, placed));

      if (!hasOverlap && x >= 0 && y >= 0 &&
          x + dims.width <= containerWidth && y + dims.height <= containerHeight) {
        return { x, y };
      }

      angle += angleStep;
      const spiralTurns = angle / (Math.PI * 2);
      radius = startRadius + radiusStep * Math.pow(spiralTurns, 0.75);
    }

    return null;
  };

  // Layout algorithm - positions all words
  useEffect(() => {
    if (wordCloudData.length === 0) return;

    const width = containerSize.width;
    const height = containerSize.height;
    const positioned: PositionedWord[] = [];

    // Process words in order of prominence (already sorted by count, largest first)
    wordCloudData.forEach((word, index) => {
      const fontSize = getFontSize(word.value, width);
      const fontWeight = getFontWeight(word.value);

      // Randomize rotation order for better interspersion
      const seed = index * 0.618033988749895;
      const random = seed - Math.floor(seed);

      let rotationCandidates: number[];
      if (random < 0.33) {
        rotationCandidates = [0, 90, -90];
      } else if (random < 0.66) {
        rotationCandidates = [90, -90, 0];
      } else {
        rotationCandidates = [-90, 0, 90];
      }

      let bestResult: {
        x: number;
        y: number;
        rotation: number;
        width: number;
        height: number;
        distance: number;
      } | null = null;
      let bestDistance = Infinity;

      for (const testRotation of rotationCandidates) {
        const dims = estimateWordDimensions(word.text, fontSize, testRotation);
        const position = findPosition(
          word,
          fontSize,
          testRotation,
          positioned,
          width,
          height,
          index,
          wordCloudData.length
        );

        if (position) {
          // Calculate distance from center
          const centerX = width / 2;
          const centerY = height / 2;
          const posX = position.x + dims.width / 2;
          const posY = position.y + dims.height / 2;
          const distance = Math.sqrt(
            Math.pow(posX - centerX, 2) + Math.pow(posY - centerY, 2)
          );

          // Check if this rotation would create variety
          const nearby = positioned.filter(p => {
            const pCenterX = p.x + p.width / 2;
            const pCenterY = p.y + p.height / 2;
            const dist = Math.sqrt(
              Math.pow(posX - pCenterX, 2) + Math.pow(posY - pCenterY, 2)
            );
            return dist < 150;
          });

          const horizontalCount = nearby.filter(p => p.rotation === 0).length;
          const verticalCount = nearby.filter(p => Math.abs(p.rotation) === 90).length;

          // Stronger penalty if too many nearby words have same orientation
          let varietyPenalty = 0;
          if (testRotation === 0 && horizontalCount > verticalCount + 1) {
            varietyPenalty = 100; // Stronger penalty to force more variety
          } else if (Math.abs(testRotation) === 90 && verticalCount > horizontalCount + 1) {
            varietyPenalty = 100;
          }

          // Add small random factor to break ties and increase variety
          const randomFactor = (random * 30) - 15; // -15 to +15

          // Prefer positions closer to center, especially for prominent words
          const prominence = 1 - (index / wordCloudData.length);
          const weightedDistance = (distance + varietyPenalty + randomFactor) * (1 + prominence);

          if (weightedDistance < bestDistance) {
            bestDistance = weightedDistance;
            bestResult = {
              x: position.x,
              y: position.y,
              rotation: testRotation,
              width: dims.width,
              height: dims.height,
              distance
            };
          }
        }
      }

      // Use the best position found
      if (bestResult) {
        positioned.push({
          ...word,
          x: bestResult.x,
          y: bestResult.y,
          width: bestResult.width,
          height: bestResult.height,
          rotation: bestResult.rotation,
          fontSize,
          fontWeight
        });
      }
    });

    setPositionedWords(positioned);
  }, [wordCloudData, containerSize]);

  // Measure container size
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height, x, y } = entry.contentRect;
        setContainerSize({
          width: width || 800,
          height: height || 400,
          offsetX: x || 0,
          offsetY: y || 0
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div className="mood-visualization">
      <h3 className="visualization-title">Your Mood Fabric</h3>
      <div className="mood-cloud-container-packed" ref={containerRef}>
        {positionedWords.map((word, index) => {
          const percentage = ((word.value / totalCount) * 100).toFixed(1);

          // Add container padding offsets to position within content area
          const adjustedLeft = word.x + word.width / 2 + containerSize.offsetX;
          const adjustedTop = word.y + word.height / 2 + containerSize.offsetY;

          return (
            <span
              key={word.text}
              className="mood-cloud-word-packed"
              style={{
                position: 'absolute',
                left: `${adjustedLeft}px`,
                top: `${adjustedTop}px`,
                fontSize: `${word.fontSize}pt`,
                fontWeight: word.fontWeight,
                color: word.color,
                ['--rotation' as any]: `${word.rotation}deg`,
                animationDelay: `${index * 0.03}s`,
                zIndex: 1,
                transform: `translate(-50%, -50%) rotate(${word.rotation}deg)`,
                transformOrigin: 'center center',
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
