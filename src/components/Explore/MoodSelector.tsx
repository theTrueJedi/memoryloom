import React, { useState } from 'react';
import { EmotionLabel } from '../../types';
import {
  getSentimentColor,
  getSentimentEmoji,
  getAllEmotionLabels,
  formatEmotionLabel,
} from '../../utils/sentimentUtils';

interface MoodSelectorProps {
  currentPrimary: EmotionLabel;
  currentSecondary?: EmotionLabel;
  onSave: (primary: EmotionLabel, secondary?: EmotionLabel) => void;
  onCancel: () => void;
}

const MoodSelector: React.FC<MoodSelectorProps> = ({
  currentPrimary,
  currentSecondary,
  onSave,
  onCancel,
}) => {
  const [selectedPrimary, setSelectedPrimary] = useState<EmotionLabel>(currentPrimary);
  const [selectedSecondary, setSelectedSecondary] = useState<EmotionLabel | undefined>(
    currentSecondary
  );

  const allEmotions = getAllEmotionLabels();

  const handlePrimarySelect = (emotion: EmotionLabel) => {
    setSelectedPrimary(emotion);
    // If the newly selected primary was the secondary, clear secondary
    if (selectedSecondary === emotion) {
      setSelectedSecondary(undefined);
    }
  };

  const handleSecondarySelect = (emotion: EmotionLabel) => {
    // Toggle: if clicking the same one, deselect it
    if (selectedSecondary === emotion) {
      setSelectedSecondary(undefined);
    } else {
      setSelectedSecondary(emotion);
    }
  };

  const handleSave = () => {
    onSave(selectedPrimary, selectedSecondary);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="mood-selector" onKeyDown={handleKeyDown}>
      <div className="mood-selector-columns">
        {/* Primary Mood Column */}
        <div className="mood-column">
          <h4 className="mood-column-title">Primary Mood</h4>
          <div className="mood-current">
            <div
              className="mood-indicator"
              style={{ backgroundColor: getSentimentColor(selectedPrimary) }}
            >
              {getSentimentEmoji(selectedPrimary)}
            </div>
            <span className="mood-label">{formatEmotionLabel(selectedPrimary)}</span>
          </div>
          <div className="mood-options">
            {allEmotions.map((emotion) => (
              <button
                key={emotion}
                className={`mood-option ${selectedPrimary === emotion ? 'selected' : ''}`}
                onClick={() => handlePrimarySelect(emotion)}
                style={{
                  borderColor:
                    selectedPrimary === emotion
                      ? getSentimentColor(emotion)
                      : 'transparent',
                }}
              >
                <div
                  className="mood-option-indicator"
                  style={{ backgroundColor: getSentimentColor(emotion) }}
                >
                  {getSentimentEmoji(emotion)}
                </div>
                <span className="mood-option-label">{formatEmotionLabel(emotion)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Mood Column */}
        <div className="mood-column">
          <h4 className="mood-column-title">Secondary Mood</h4>
          <div className="mood-current">
            {selectedSecondary ? (
              <>
                <div
                  className="mood-indicator"
                  style={{ backgroundColor: getSentimentColor(selectedSecondary) }}
                >
                  {getSentimentEmoji(selectedSecondary)}
                </div>
                <span className="mood-label">{formatEmotionLabel(selectedSecondary)}</span>
              </>
            ) : (
              <span className="mood-label-empty">None selected</span>
            )}
          </div>
          <div className="mood-options">
            <button
              className={`mood-option ${!selectedSecondary ? 'selected' : ''}`}
              onClick={() => setSelectedSecondary(undefined)}
              style={{
                borderColor: !selectedSecondary ? 'var(--border-medium)' : 'transparent',
              }}
            >
              <div
                className="mood-option-indicator"
                style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}
              >
                ✕
              </div>
              <span className="mood-option-label">None</span>
            </button>
            {allEmotions
              .filter((emotion) => emotion !== selectedPrimary)
              .map((emotion) => (
                <button
                  key={emotion}
                  className={`mood-option ${selectedSecondary === emotion ? 'selected' : ''}`}
                  onClick={() => handleSecondarySelect(emotion)}
                  style={{
                    borderColor:
                      selectedSecondary === emotion
                        ? getSentimentColor(emotion)
                        : 'transparent',
                  }}
                >
                  <div
                    className="mood-option-indicator"
                    style={{ backgroundColor: getSentimentColor(emotion) }}
                  >
                    {getSentimentEmoji(emotion)}
                  </div>
                  <span className="mood-option-label">{formatEmotionLabel(emotion)}</span>
                </button>
              ))}
          </div>
        </div>
      </div>

      <div className="mood-selector-actions">
        <button className="button-accept" onClick={handleSave}>
          Save
        </button>
        <button className="button-reject" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default MoodSelector;
