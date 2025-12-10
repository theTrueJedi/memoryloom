import React, { useState, useEffect } from 'react';
import { SentimentSuggestion } from '../../types';
import {
  subscribeToSentimentSuggestions,
  applySentimentSuggestion,
  updateSentimentSuggestionStatus,
  bulkUpdateSentimentSuggestions,
} from '../../services/firestore';
import { useAuth } from '../../contexts/AuthContext';
import {
  getSentimentColor,
  getSentimentEmoji,
  formatEmotionLabel,
} from '../../utils/sentimentUtils';
import './SentimentSuggestionReview.css';

const SentimentSuggestionReview: React.FC = () => {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<SentimentSuggestion[]>([]);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToSentimentSuggestions(user.uid, (newSuggestions) => {
      setSuggestions(newSuggestions);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAccept = async (suggestion: SentimentSuggestion) => {
    if (!user) return;

    setProcessingIds((prev) => new Set(prev).add(suggestion.id));
    try {
      await applySentimentSuggestion(
        user.uid,
        suggestion.id,
        suggestion.thoughtId,
        suggestion.suggestedSentiment
      );
    } catch (error) {
      console.error('Error accepting sentiment suggestion:', error);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(suggestion.id);
        return next;
      });
    }
  };

  const handleReject = async (suggestion: SentimentSuggestion) => {
    if (!user) return;

    setProcessingIds((prev) => new Set(prev).add(suggestion.id));
    try {
      await updateSentimentSuggestionStatus(user.uid, suggestion.id, 'rejected');
    } catch (error) {
      console.error('Error rejecting sentiment suggestion:', error);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(suggestion.id);
        return next;
      });
    }
  };

  const handleAcceptAll = async () => {
    if (!user || suggestions.length === 0) return;

    setIsBulkProcessing(true);
    try {
      const ids = suggestions.map((s) => s.id);
      await bulkUpdateSentimentSuggestions(user.uid, ids, 'accepted', suggestions);
    } catch (error) {
      console.error('Error accepting all suggestions:', error);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleRejectAll = async () => {
    if (!user || suggestions.length === 0) return;

    setIsBulkProcessing(true);
    try {
      const ids = suggestions.map((s) => s.id);
      await bulkUpdateSentimentSuggestions(user.uid, ids, 'rejected');
    } catch (error) {
      console.error('Error rejecting all suggestions:', error);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const truncateContent = (content: string, maxLength: number = 100): string => {
    // Strip HTML tags for display
    const textContent = content.replace(/<[^>]*>/g, '').trim();
    if (textContent.length <= maxLength) return textContent;
    return textContent.substring(0, maxLength) + '...';
  };

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="sentiment-suggestion-review">
      <div className="sentiment-review-header">
        <span className="sentiment-review-count">
          {suggestions.length} pending change{suggestions.length !== 1 ? 's' : ''}
        </span>
        <div className="sentiment-review-bulk-actions">
          <button
            className="sentiment-review-accept-all"
            onClick={handleAcceptAll}
            disabled={isBulkProcessing}
          >
            {isBulkProcessing ? 'Processing...' : `Accept All (${suggestions.length})`}
          </button>
          <button
            className="sentiment-review-reject-all"
            onClick={handleRejectAll}
            disabled={isBulkProcessing}
          >
            Reject All
          </button>
        </div>
      </div>

      <div className="sentiment-review-list">
        {suggestions.map((suggestion) => {
          const isProcessing = processingIds.has(suggestion.id) || isBulkProcessing;

          return (
            <div key={suggestion.id} className="sentiment-review-item">
              <div className="sentiment-review-content">
                {truncateContent(suggestion.thoughtContent)}
              </div>
              <div className="sentiment-review-change">
                <div className="sentiment-review-sentiment">
                  <span
                    className="sentiment-review-indicator"
                    style={{ backgroundColor: getSentimentColor(suggestion.previousSentiment.label) }}
                  >
                    {getSentimentEmoji(suggestion.previousSentiment.label)}
                  </span>
                  <span className="sentiment-review-label">
                    {formatEmotionLabel(suggestion.previousSentiment.label)}
                  </span>
                </div>
                <span className="sentiment-review-arrow">→</span>
                <div className="sentiment-review-sentiment">
                  <span
                    className="sentiment-review-indicator"
                    style={{ backgroundColor: getSentimentColor(suggestion.suggestedSentiment.label) }}
                  >
                    {getSentimentEmoji(suggestion.suggestedSentiment.label)}
                  </span>
                  <span className="sentiment-review-label">
                    {formatEmotionLabel(suggestion.suggestedSentiment.label)}
                  </span>
                </div>
              </div>
              <div className="sentiment-review-actions">
                <button
                  className="sentiment-review-accept"
                  onClick={() => handleAccept(suggestion)}
                  disabled={isProcessing}
                  title="Accept"
                >
                  ✓
                </button>
                <button
                  className="sentiment-review-reject"
                  onClick={() => handleReject(suggestion)}
                  disabled={isProcessing}
                  title="Reject"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SentimentSuggestionReview;
