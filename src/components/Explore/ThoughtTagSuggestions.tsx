import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { TagSuggestion } from '../../types';
import {
  applyTagSuggestion,
  updateTagSuggestionStatus,
} from '../../services/firestore';
import { db } from '../../services/firebase';
import {
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
} from 'firebase/firestore';

interface ThoughtTagSuggestionsProps {
  thoughtId: string;
}

const ThoughtTagSuggestions: React.FC<ThoughtTagSuggestionsProps> = ({ thoughtId }) => {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    // Subscribe to suggestions for this specific thought
    const suggestionsRef = collection(db, `users/${user.uid}/tagSuggestions`);
    const q = query(
      suggestionsRef,
      where('thoughtId', '==', thoughtId),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const thoughtSuggestions = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as TagSuggestion[];

      // Sort by createdAt in memory instead of in query
      thoughtSuggestions.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });

      console.log('Tag suggestions loaded:', thoughtSuggestions);
      setSuggestions(thoughtSuggestions);
    }, (error) => {
      console.error('Error loading tag suggestions:', error);
    });

    return () => unsubscribe();
  }, [user, thoughtId]);

  const handleAccept = async (suggestion: TagSuggestion) => {
    if (!user) return;

    console.log('Accepting suggestion:', suggestion);
    setProcessingId(suggestion.id);
    try {
      await applyTagSuggestion(
        user.uid,
        suggestion.id,
        suggestion.thoughtId,
        suggestion.suggestedTag
      );
      console.log('Suggestion accepted successfully');
    } catch (error) {
      console.error('Error accepting suggestion:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (suggestion: TagSuggestion) => {
    if (!user) return;

    console.log('Rejecting suggestion:', suggestion);
    setProcessingId(suggestion.id);
    try {
      await updateTagSuggestionStatus(user.uid, suggestion.id, 'rejected');
      console.log('Suggestion rejected successfully');
    } catch (error) {
      console.error('Error rejecting suggestion:', error);
    } finally {
      setProcessingId(null);
    }
  };

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="thought-suggestions">
      <div className="thought-suggestions-header">
        <span className="thought-suggestions-title">AI Suggestions</span>
      </div>
      <div className="thought-suggestions-list">
        {suggestions.map((suggestion) => (
          <div key={suggestion.id} className="thought-suggestion-item">
            <div className="thought-suggestion-content">
              <span className="thought-suggestion-tag">
                #{suggestion.suggestedTag}
              </span>
              {suggestion.isNewTag && (
                <span className="thought-suggestion-new-badge">New</span>
              )}
            </div>
            <div className="thought-suggestion-actions">
              <button
                className="thought-suggestion-accept"
                onClick={() => handleAccept(suggestion)}
                disabled={processingId === suggestion.id}
                title="Accept"
              >
                ✓
              </button>
              <button
                className="thought-suggestion-reject"
                onClick={() => handleReject(suggestion)}
                disabled={processingId === suggestion.id}
                title="Reject"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ThoughtTagSuggestions;
