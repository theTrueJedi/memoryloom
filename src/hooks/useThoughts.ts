import { useState, useEffect } from 'react';
import { Thought, Sentiment } from '../types';
import {
  createThought,
  updateThought,
  deleteThought,
  subscribeToThoughts,
} from '../services/firestore';

export const useThoughts = (userId: string | undefined) => {
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToThoughts(userId, (newThoughts) => {
      setThoughts(newThoughts);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const addThought = async (
    content: string,
    tags: string[],
    sentiment: Sentiment
  ): Promise<string | null> => {
    if (!userId) {
      setError('User not authenticated');
      return null;
    }

    try {
      const thoughtId = await createThought(userId, content, tags, sentiment);
      return thoughtId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create thought');
      console.error('Error creating thought:', err);
      return null;
    }
  };

  const editThought = async (
    thoughtId: string,
    updates: Partial<Thought>
  ): Promise<void> => {
    if (!userId) {
      setError('User not authenticated');
      return;
    }

    try {
      await updateThought(userId, thoughtId, updates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update thought');
      console.error('Error updating thought:', err);
    }
  };

  const removeThought = async (thoughtId: string): Promise<void> => {
    if (!userId) {
      setError('User not authenticated');
      return;
    }

    try {
      await deleteThought(userId, thoughtId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete thought');
      console.error('Error deleting thought:', err);
    }
  };

  return {
    thoughts,
    loading,
    error,
    addThought,
    editThought,
    removeThought,
  };
};
