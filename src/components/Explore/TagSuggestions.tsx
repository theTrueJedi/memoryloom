import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { TagSuggestion } from '../../types';
import {
  subscribeToTagSuggestions,
  applyTagSuggestion,
  updateTagSuggestionStatus,
} from '../../services/firestore';

const TagSuggestions: React.FC = () => {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToTagSuggestions(user.uid, (newSuggestions) => {
      setSuggestions(newSuggestions);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAccept = async (suggestion: TagSuggestion) => {
    if (!user) return;

    setProcessingId(suggestion.id);
    try {
      await applyTagSuggestion(
        user.uid,
        suggestion.id,
        suggestion.thoughtId,
        suggestion.suggestedTag
      );
    } catch (error) {
      console.error('Error accepting suggestion:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (suggestion: TagSuggestion) => {
    if (!user) return;

    setProcessingId(suggestion.id);
    try {
      await updateTagSuggestionStatus(user.uid, suggestion.id, 'rejected');
    } catch (error) {
      console.error('Error rejecting suggestion:', error);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return null;
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="tag-suggestions-section">
      <h3 className="section-title">
        AI Tag Suggestions <span className="suggestion-badge">{suggestions.length}</span>
      </h3>
      <div className="suggestions-list">
        {suggestions.map((suggestion) => (
          <div key={suggestion.id} className="suggestion-card">
            <div className="suggestion-header">
              <span className="suggestion-tag">
                #{suggestion.suggestedTag}
              </span>
              {suggestion.isNewTag && (
                <span className="new-tag-badge">New</span>
              )}
            </div>
            <p className="suggestion-reason">{suggestion.reason}</p>
            <div className="suggestion-actions">
              <button
                className="button-accept"
                onClick={() => handleAccept(suggestion)}
                disabled={processingId === suggestion.id}
              >
                Accept
              </button>
              <button
                className="button-reject"
                onClick={() => handleReject(suggestion)}
                disabled={processingId === suggestion.id}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TagSuggestions;
