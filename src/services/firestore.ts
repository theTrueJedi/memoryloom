import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  setDoc,
  Timestamp,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { Thought, Tag, TagSuggestion, Sentiment } from '../types';

// ========== Thought Operations ==========

export const createThought = async (
  userId: string,
  content: string,
  tags: string[],
  sentiment: Sentiment,
  customTimestamp?: Timestamp
): Promise<string> => {
  const thoughtsRef = collection(db, `users/${userId}/thoughts`);
  const timestamp = customTimestamp || Timestamp.now();

  // Clean sentiment object - remove undefined values for Firestore
  const cleanedSentiment: any = {
    score: sentiment.score,
    magnitude: sentiment.magnitude,
    label: sentiment.label,
  };

  // Only add secondaryLabel if it's defined
  if (sentiment.secondaryLabel !== undefined) {
    cleanedSentiment.secondaryLabel = sentiment.secondaryLabel;
  }

  const docRef = await addDoc(thoughtsRef, {
    userId,
    content,
    tags,
    sentiment: cleanedSentiment,
    timestamp,
    createdAt: timestamp,
  });

  // Update tag usage
  await updateTagUsage(userId, tags);

  return docRef.id;
};

export const updateThought = async (
  userId: string,
  thoughtId: string,
  updates: Partial<Thought>
): Promise<void> => {
  const thoughtRef = doc(db, `users/${userId}/thoughts`, thoughtId);

  // Clean updates to remove undefined values
  const cleanedUpdates: any = { ...updates };

  // If sentiment is being updated, clean it
  if (cleanedUpdates.sentiment) {
    const sentiment = cleanedUpdates.sentiment;
    cleanedUpdates.sentiment = {
      score: sentiment.score,
      magnitude: sentiment.magnitude,
      label: sentiment.label,
    };

    // Only add secondaryLabel if it's defined
    if (sentiment.secondaryLabel !== undefined) {
      cleanedUpdates.sentiment.secondaryLabel = sentiment.secondaryLabel;
    }
  }

  await updateDoc(thoughtRef, cleanedUpdates);
};

export const deleteThought = async (userId: string, thoughtId: string): Promise<void> => {
  const thoughtRef = doc(db, `users/${userId}/thoughts`, thoughtId);
  await deleteDoc(thoughtRef);
};

export const getThought = async (userId: string, thoughtId: string): Promise<Thought | null> => {
  const thoughtRef = doc(db, `users/${userId}/thoughts`, thoughtId);
  const thoughtSnap = await getDoc(thoughtRef);

  if (!thoughtSnap.exists()) {
    return null;
  }

  return {
    id: thoughtSnap.id,
    ...thoughtSnap.data(),
  } as Thought;
};

export const getAllThoughts = async (userId: string): Promise<Thought[]> => {
  const thoughtsRef = collection(db, `users/${userId}/thoughts`);
  const q = query(thoughtsRef, orderBy('timestamp', 'desc'));
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Thought[];
};

export const getThoughtsByTag = async (userId: string, tag: string): Promise<Thought[]> => {
  const thoughtsRef = collection(db, `users/${userId}/thoughts`);
  const q = query(
    thoughtsRef,
    where('tags', 'array-contains', tag),
    orderBy('timestamp', 'desc')
  );
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Thought[];
};

export const subscribeToThoughts = (
  userId: string,
  callback: (thoughts: Thought[]) => void
): (() => void) => {
  const thoughtsRef = collection(db, `users/${userId}/thoughts`);
  const q = query(thoughtsRef, orderBy('timestamp', 'desc'));

  return onSnapshot(q, (querySnapshot) => {
    const thoughts = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Thought[];
    callback(thoughts);
  });
};

// ========== Tag Operations ==========

export const updateTagUsage = async (userId: string, tags: string[]): Promise<void> => {
  const batch = writeBatch(db);
  const now = Timestamp.now();

  for (const tagName of tags) {
    const tagRef = doc(db, `users/${userId}/tags`, tagName);
    const tagSnap = await getDoc(tagRef);

    if (tagSnap.exists()) {
      // Update existing tag
      const currentCount = tagSnap.data().usageCount || 0;
      batch.update(tagRef, {
        usageCount: currentCount + 1,
        lastUsed: now,
      });
    } else {
      // Create new tag
      batch.set(tagRef, {
        id: tagName,
        userId,
        name: tagName,
        usageCount: 1,
        firstUsed: now,
        lastUsed: now,
      });
    }
  }

  await batch.commit();
};

export const getAllTags = async (userId: string): Promise<Tag[]> => {
  const tagsRef = collection(db, `users/${userId}/tags`);
  const q = query(tagsRef, orderBy('lastUsed', 'desc'));
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Tag[];
};

export const subscribeToTags = (
  userId: string,
  callback: (tags: Tag[]) => void
): (() => void) => {
  const tagsRef = collection(db, `users/${userId}/tags`);
  const q = query(tagsRef, orderBy('lastUsed', 'desc'));

  return onSnapshot(q, (querySnapshot) => {
    const tags = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Tag[];
    callback(tags);
  });
};

export const renameTag = async (
  userId: string,
  oldName: string,
  newName: string
): Promise<void> => {
  const oldTagRef = doc(db, `users/${userId}/tags`, oldName);
  const newTagRef = doc(db, `users/${userId}/tags`, newName);

  // Get the old tag data
  const oldTagSnap = await getDoc(oldTagRef);
  if (!oldTagSnap.exists()) {
    throw new Error('Tag not found');
  }

  const oldTagData = oldTagSnap.data();

  // Create new tag with updated name
  await setDoc(newTagRef, {
    ...oldTagData,
    id: newName,
    name: newName,
  });

  // Delete old tag
  await deleteDoc(oldTagRef);
};

export const deleteTag = async (userId: string, tagName: string): Promise<void> => {
  const tagRef = doc(db, `users/${userId}/tags`, tagName);
  await deleteDoc(tagRef);
};

// ========== Tag Suggestion Operations ==========

export const createTagSuggestion = async (
  userId: string,
  thoughtId: string,
  suggestedTag: string,
  isNewTag: boolean,
  reason: string
): Promise<string> => {
  const suggestionsRef = collection(db, `users/${userId}/tagSuggestions`);

  const docRef = await addDoc(suggestionsRef, {
    userId,
    thoughtId,
    suggestedTag,
    isNewTag,
    reason,
    status: 'pending',
    createdAt: Timestamp.now(),
  });

  return docRef.id;
};

export const updateTagSuggestionStatus = async (
  userId: string,
  suggestionId: string,
  status: 'accepted' | 'rejected'
): Promise<void> => {
  const suggestionRef = doc(db, `users/${userId}/tagSuggestions`, suggestionId);
  await updateDoc(suggestionRef, { status });
};

export const getPendingTagSuggestions = async (userId: string): Promise<TagSuggestion[]> => {
  const suggestionsRef = collection(db, `users/${userId}/tagSuggestions`);
  const q = query(
    suggestionsRef,
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as TagSuggestion[];
};

export const subscribeToTagSuggestions = (
  userId: string,
  callback: (suggestions: TagSuggestion[]) => void
): (() => void) => {
  const suggestionsRef = collection(db, `users/${userId}/tagSuggestions`);
  const q = query(
    suggestionsRef,
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (querySnapshot) => {
    const suggestions = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as TagSuggestion[];
    callback(suggestions);
  });
};

export const applyTagSuggestion = async (
  userId: string,
  suggestionId: string,
  thoughtId: string,
  tag: string
): Promise<void> => {
  // Get the thought
  const thought = await getThought(userId, thoughtId);
  if (!thought) {
    throw new Error('Thought not found');
  }

  // Add tag if not already present
  if (!thought.tags.includes(tag)) {
    const updatedTags = [...thought.tags, tag];
    await updateThought(userId, thoughtId, { tags: updatedTags });
    await updateTagUsage(userId, [tag]);
  }

  // Mark suggestion as accepted
  await updateTagSuggestionStatus(userId, suggestionId, 'accepted');
};
