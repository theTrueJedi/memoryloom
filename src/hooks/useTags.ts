import { useState, useEffect } from 'react';
import { Tag } from '../types';
import { subscribeToTags, updateTagUsage, subscribeToThoughts } from '../services/firestore';

export const useTags = (userId: string | undefined) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Subscribe to both tags and thoughts to calculate accurate counts
    let tagsData: Tag[] = [];
    let thoughtsData: any[] = [];

    const unsubscribeTags = subscribeToTags(userId, (newTags) => {
      tagsData = newTags;
      updateTagsWithCounts();
    });

    const unsubscribeThoughts = subscribeToThoughts(userId, (newThoughts) => {
      thoughtsData = newThoughts;
      updateTagsWithCounts();
    });

    const updateTagsWithCounts = () => {
      // Calculate actual usage counts from thoughts (case-insensitive)
      const tagsWithCounts = tagsData.map(tag => {
        const count = thoughtsData.filter(thought =>
          thought.tags.some((t: string) => t.toLowerCase() === tag.name.toLowerCase())
        ).length;
        return {
          ...tag,
          usageCount: count
        };
      });

      setTags(tagsWithCounts);
      setLoading(false);
    };

    return () => {
      unsubscribeTags();
      unsubscribeThoughts();
    };
  }, [userId]);

  const addTag = async (tagName: string): Promise<void> => {
    if (!userId) {
      throw new Error('User not authenticated');
    }

    // updateTagUsage will create the tag if it doesn't exist
    await updateTagUsage(userId, [tagName]);
  };

  return {
    tags,
    loading,
    addTag,
  };
};
