import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Timestamp } from 'firebase/firestore';
import { Thought, Sentiment } from '../../types';
import { analyzeSentiment, suggestTags } from '../../services/gemini';
import { createTagSuggestion, getAllTags, updateThought } from '../../services/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { getSentimentColor, getSentimentEmoji, formatEmotionLabel } from '../../utils/sentimentUtils';
import './TimestampEditor.css';

interface TimestampEditorProps {
  thought: Thought;
  isOpen: boolean;
  onClose: () => void;
  onSave: (newTimestamp: Timestamp) => Promise<void>;
  onThoughtUpdated?: () => void;
}

const TimestampEditor: React.FC<TimestampEditorProps> = ({
  thought,
  isOpen,
  onClose,
  onSave,
  onThoughtUpdated,
}) => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReprocessingSentiment, setIsReprocessingSentiment] = useState(false);
  const [isReprocessingTags, setIsReprocessingTags] = useState(false);
  const [reprocessMessage, setReprocessMessage] = useState<string | null>(null);
  const [sentimentPreview, setSentimentPreview] = useState<Sentiment | null>(null);
  const [isApplyingSentiment, setIsApplyingSentiment] = useState(false);

  // Initialize date/time from thought's current timestamp
  useEffect(() => {
    if (isOpen && thought.timestamp) {
      const date = thought.timestamp.toDate();
      // Format date as YYYY-MM-DD for input[type="date"]
      const dateStr = date.toISOString().split('T')[0];
      // Format time as HH:MM for input[type="time"]
      const timeStr = date.toTimeString().slice(0, 5);
      setSelectedDate(dateStr);
      setSelectedTime(timeStr);
      setError(null);
    }
  }, [isOpen, thought.timestamp]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSave = async () => {
    try {
      setError(null);
      setIsSaving(true);

      // Combine date and time into a Date object
      const dateTimeStr = `${selectedDate}T${selectedTime}`;
      const newDate = new Date(dateTimeStr);

      // Validate: prevent future dates
      const now = new Date();
      if (newDate > now) {
        setError('Cannot set a future date');
        setIsSaving(false);
        return;
      }

      // Validate: ensure valid date
      if (isNaN(newDate.getTime())) {
        setError('Invalid date or time');
        setIsSaving(false);
        return;
      }

      // Convert to Firebase Timestamp
      const newTimestamp = Timestamp.fromDate(newDate);

      // Call save handler
      await onSave(newTimestamp);

      // Close modal on success
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update timestamp');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReprocessSentiment = async () => {
    if (!user) return;

    try {
      setIsReprocessingSentiment(true);
      setReprocessMessage(null);
      setError(null);
      setSentimentPreview(null);

      const newSentiment = await analyzeSentiment(thought.content);
      setSentimentPreview(newSentiment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reprocess sentiment');
    } finally {
      setIsReprocessingSentiment(false);
    }
  };

  const handleAcceptSentiment = async () => {
    if (!user || !sentimentPreview) return;

    try {
      setIsApplyingSentiment(true);
      setError(null);

      const sanitizedSentiment: any = {
        score: sentimentPreview.score,
        magnitude: sentimentPreview.magnitude,
        label: sentimentPreview.label,
      };

      if (sentimentPreview.secondaryLabel !== undefined) {
        sanitizedSentiment.secondaryLabel = sentimentPreview.secondaryLabel;
      }

      await updateThought(user.uid, thought.id, { sentiment: sanitizedSentiment });
      setReprocessMessage(`Sentiment updated to: ${sentimentPreview.label}`);
      setSentimentPreview(null);
      onThoughtUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply sentiment');
    } finally {
      setIsApplyingSentiment(false);
    }
  };

  const handleRejectSentiment = () => {
    setSentimentPreview(null);
    setReprocessMessage('Sentiment change rejected');
  };

  const handleReprocessTags = async () => {
    if (!user) return;

    try {
      setIsReprocessingTags(true);
      setReprocessMessage(null);
      setError(null);

      const existingTags = await getAllTags(user.uid);
      const tagNames = existingTags.map(t => t.name);

      const suggestions = await suggestTags(thought.content, tagNames);

      let suggestionsCreated = 0;

      // Create suggestions for existing tags
      for (const tag of suggestions.existingTags) {
        if (!thought.tags?.includes(tag)) {
          await createTagSuggestion(
            user.uid,
            thought.id,
            tag,
            false,
            `AI suggested existing tag: ${suggestions.reasoning}`
          );
          suggestionsCreated++;
        }
      }

      // Create suggestion for new tag
      if (suggestions.newTag && !thought.tags?.includes(suggestions.newTag)) {
        await createTagSuggestion(
          user.uid,
          thought.id,
          suggestions.newTag,
          true,
          `AI suggested new tag: ${suggestions.reasoning}`
        );
        suggestionsCreated++;
      }

      setReprocessMessage(
        suggestionsCreated > 0
          ? `Created ${suggestionsCreated} tag suggestion(s)`
          : 'No new tag suggestions'
      );
      onThoughtUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reprocess tags');
    } finally {
      setIsReprocessingTags(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const currentDate = thought.timestamp.toDate();

  const isProcessing = isSaving || isReprocessingSentiment || isReprocessingTags || isApplyingSentiment;

  const modalContent = (
    <div className="timestamp-editor-backdrop" onClick={handleBackdropClick}>
      <div className="timestamp-editor-modal">
        <h2 className="timestamp-editor-title">Thought Options</h2>

        <div className="timestamp-editor-section">
          <h3 className="timestamp-editor-section-title">Timestamp</h3>
          <div className="timestamp-editor-current">
            <strong>Current:</strong> {currentDate.toLocaleString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })}
          </div>

          <div className="timestamp-editor-inputs">
            <div className="timestamp-editor-field">
              <label htmlFor="date-input">Date</label>
              <input
                id="date-input"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                disabled={isProcessing}
              />
            </div>

            <div className="timestamp-editor-field">
              <label htmlFor="time-input">Time</label>
              <input
                id="time-input"
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                disabled={isProcessing}
              />
            </div>
          </div>

          <div className="timestamp-editor-warning">
            This will change when this thought appears in your timeline
          </div>

          <button
            className="timestamp-editor-save"
            onClick={handleSave}
            disabled={isProcessing}
            style={{ marginTop: '0.5rem' }}
          >
            {isSaving ? 'Saving...' : 'Update Timestamp'}
          </button>
        </div>

        <div className="timestamp-editor-section">
          <h3 className="timestamp-editor-section-title">Reprocess</h3>

          {sentimentPreview ? (
            <div className="timestamp-sentiment-preview">
              <div className="timestamp-sentiment-comparison">
                <div className="sentiment-preview-row">
                  <span className="sentiment-preview-label">Current:</span>
                  <div className="sentiment-preview-indicators">
                    <span
                      className="sentiment-preview-indicator primary"
                      style={{ backgroundColor: getSentimentColor(thought.sentiment.label) }}
                    >
                      {getSentimentEmoji(thought.sentiment.label)}
                    </span>
                    {thought.sentiment.secondaryLabel && (
                      <span
                        className="sentiment-preview-indicator secondary"
                        style={{ backgroundColor: getSentimentColor(thought.sentiment.secondaryLabel) }}
                      >
                        {getSentimentEmoji(thought.sentiment.secondaryLabel)}
                      </span>
                    )}
                  </div>
                  <span className="sentiment-preview-text">
                    {formatEmotionLabel(thought.sentiment.label)}
                    {thought.sentiment.secondaryLabel && (
                      <span className="sentiment-preview-secondary">
                        {' + '}{formatEmotionLabel(thought.sentiment.secondaryLabel)}
                      </span>
                    )}
                  </span>
                </div>
                <span className="sentiment-preview-arrow">↓</span>
                <div className="sentiment-preview-row">
                  <span className="sentiment-preview-label">Proposed:</span>
                  <div className="sentiment-preview-indicators">
                    <span
                      className="sentiment-preview-indicator primary"
                      style={{ backgroundColor: getSentimentColor(sentimentPreview.label) }}
                    >
                      {getSentimentEmoji(sentimentPreview.label)}
                    </span>
                    {sentimentPreview.secondaryLabel && (
                      <span
                        className="sentiment-preview-indicator secondary"
                        style={{ backgroundColor: getSentimentColor(sentimentPreview.secondaryLabel) }}
                      >
                        {getSentimentEmoji(sentimentPreview.secondaryLabel)}
                      </span>
                    )}
                  </div>
                  <span className="sentiment-preview-text">
                    {formatEmotionLabel(sentimentPreview.label)}
                    {sentimentPreview.secondaryLabel && (
                      <span className="sentiment-preview-secondary">
                        {' + '}{formatEmotionLabel(sentimentPreview.secondaryLabel)}
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <div className="timestamp-sentiment-actions">
                <button
                  className="sentiment-preview-accept"
                  onClick={handleAcceptSentiment}
                  disabled={isApplyingSentiment}
                >
                  {isApplyingSentiment ? 'Applying...' : '✓ Accept'}
                </button>
                <button
                  className="sentiment-preview-reject"
                  onClick={handleRejectSentiment}
                  disabled={isApplyingSentiment}
                >
                  ✕ Reject
                </button>
              </div>
            </div>
          ) : (
            <div className="timestamp-editor-reprocess-buttons">
              <button
                className="timestamp-editor-reprocess"
                onClick={handleReprocessSentiment}
                disabled={isProcessing}
              >
                {isReprocessingSentiment ? 'Processing...' : 'Reprocess Sentiment'}
              </button>
              <button
                className="timestamp-editor-reprocess"
                onClick={handleReprocessTags}
                disabled={isProcessing}
              >
                {isReprocessingTags ? 'Processing...' : 'Reprocess Tags'}
              </button>
            </div>
          )}
        </div>

        {error && <div className="timestamp-editor-error">{error}</div>}
        {reprocessMessage && <div className="timestamp-editor-success">{reprocessMessage}</div>}

        <div className="timestamp-editor-actions">
          <button
            className="timestamp-editor-cancel"
            onClick={onClose}
            disabled={isProcessing}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default TimestampEditor;
