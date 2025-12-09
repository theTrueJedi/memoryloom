import React, { useMemo, useRef, useEffect, useState } from 'react';
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

interface PositionedWord extends WordData {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fontSize: number;
  fontWeight: number;
}

const TagCloudVisualization: React.FC<TagCloudVisualizationProps> = ({ thoughts }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [positionedWords, setPositionedWords] = useState<PositionedWord[]>([]);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 400, offsetX: 0, offsetY: 0 });

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
  const minCount = Math.min(...tagCounts.map((t) => t.count), 1);
  const totalTags = tagCounts.reduce((sum, t) => sum + t.count, 0);

  if (tagCounts.length === 0) {
    return (
      <div className="tag-cloud-visualization empty">
        <p className="empty-message">No tags in this date range</p>
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

    // Tighter character width for better packing
    const avgCharWidth = fontSizePx * 0.55;
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
    const prominence = 1 - (wordIndex / totalWords); // 1.0 for first word, 0.0 for last

    // Smaller words get more aggressive search (smaller angle steps = more positions tested)
    const angleStep = 0.05 + (prominence * 0.1); // 0.05-0.15

    // Smaller words start searching from slightly further out to find gaps
    const startRadius = prominence < 0.3 ? 20 : 0;

    // Smaller radius steps for all words
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
      // Slower radius growth for tighter packing
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
    // This ensures big, important words are placed in the center first
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

      // Use the best position found (with the rotation it was tested with!)
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
    <div className="tag-cloud-visualization">
      <h3 className="visualization-title">Your Tag Fabric</h3>
      <div className="tag-cloud-container-packed" ref={containerRef}>
        {positionedWords.map((word, index) => {
          const percentage = ((word.value / totalTags) * 100).toFixed(1);

          // For vertical text, we need to adjust positioning since rotation happens around center
          // Add container padding offsets to position within content area
          const adjustedLeft = word.x + word.width / 2 + containerSize.offsetX;
          const adjustedTop = word.y + word.height / 2 + containerSize.offsetY;

          return (
            <span
              key={word.text}
              className="tag-cloud-word-packed"
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
              title={`${word.text}: ${word.value} occurrences (${percentage}%) [${word.width.toFixed(0)}x${word.height.toFixed(0)}]`}
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
