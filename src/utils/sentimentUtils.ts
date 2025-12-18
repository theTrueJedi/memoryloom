import { EmotionLabel } from '../types';

// These functions will eventually read from user's sentiment config
// For now, using the default configuration

export const getSentimentColor = (label: string): string => {
  switch (label) {
    // Positive emotions - greens and warm colors
    case 'joy':
      return '#3f9749';
    case 'amusement':
      return '#F28500';
    case 'gratitude':
      return '#8BC34A';
    case 'pride':
      return '#FFC107';
    case 'excitement':
      return '#FF9800';
    case 'love':
      return '#df58b4';
    case 'peace':
      return '#328cb3';
    case 'hope':
      return '#54b9e8';
    case 'lucky':
      return '#2E8B57';
    case 'creative':
      return '#79d29e';
    case 'curiosity':
      return '#9227b0';
    case 'surprise':
      return '#ff8800';

    // Negative emotions - reds, blues, and grays
    case 'sadness':
      return '#4e61ca';
    case 'anxiety':
      return '#f44e4e';
    case 'frustration':
      return '#c86aaf';
    case 'anger':
      return '#ba261c';
    case 'fear':
      return '#4b4949';
    case 'shame':
      return '#a16059';
    case 'loneliness':
      return '#557d91';
    case 'disappointment':
      return '#716496';
    case 'boredom':
      return '#819c77';

    // Neutral/Other
    case 'confusion':
      return '#FF9800';
    case 'neutral':
      return '#949494';
    case 'mixed':
      return '#673AB7';

    // Meta states
    case 'processing':
      return '#d0d0d0';

    default:
      return '#949494';
  }
};

export const getSentimentEmoji = (label: string): string => {
  switch (label) {
    // Positive emotions
    case 'joy':
      return '😄';
    case 'amusement':
      return '😂';
    case 'gratitude':
      return '🙏';
    case 'pride':
      return '🌟';
    case 'excitement':
      return '🎉';
    case 'love':
      return '❤️';
    case 'peace':
      return '☮️';
    case 'hope':
      return '🌅';
    case 'lucky':
      return '🍀';
    case 'creative':
      return '🎨';
    case 'curiosity':
      return '🤔';
    case 'surprise':
      return '😲';

    // Negative emotions
    case 'sadness':
      return '😢';
    case 'anxiety':
      return '😰';
    case 'frustration':
      return '😤';
    case 'anger':
      return '😡';
    case 'fear':
      return '😨';
    case 'shame':
      return '😳';
    case 'loneliness':
      return '😔';
    case 'disappointment':
      return '😞';
    case 'boredom':
      return '😑';

    // Neutral/Other
    case 'confusion':
      return '😕';
    case 'neutral':
      return '😌';
    case 'mixed':
      return '😐';

    // Meta states
    case 'processing':
      return '🕐';

    default:
      return '😌';
  }
};

export const getAllEmotionLabels = (): EmotionLabel[] => {
  // Note: 'processing' is intentionally excluded - it's a system-only state
  return [
    'joy',
    'amusement',
    'gratitude',
    'pride',
    'excitement',
    'love',
    'peace',
    'hope',
    'lucky',
    'creative',
    'curiosity',
    'surprise',
    'sadness',
    'anxiety',
    'frustration',
    'anger',
    'fear',
    'shame',
    'loneliness',
    'disappointment',
    'boredom',
    'confusion',
    'neutral',
    'mixed',
  ];
};

export const formatEmotionLabel = (label: EmotionLabel): string => {
  return label.charAt(0).toUpperCase() + label.slice(1);
};
