import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, getDoc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

interface DraftData {
  content: string;
  detectedTags: string[];
  updatedAt: Timestamp;
}

interface UseDraftOptions {
  debounceMs?: number;
}

interface UseDraftReturn {
  draftContent: string;
  draftTags: string[];
  setDraftContent: (content: string) => void;
  setDraftTags: (tags: string[]) => void;
  clearDraft: () => Promise<void>;
  isLoading: boolean;
  hasDraft: boolean;
  lastSaved: Date | null;
}

/**
 * Get plain text from HTML content (strips tags).
 */
function getPlainText(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Check if content is effectively empty (handles Quill's empty state like <p><br></p>).
 */
function isContentEmpty(html: string): boolean {
  const plainText = getPlainText(html);
  return plainText.length === 0;
}

/**
 * Check if content contains at least one complete word.
 * A complete word is a word followed by a space, punctuation, or end of string
 * after at least one non-whitespace character.
 */
function hasCompleteWord(text: string): boolean {
  const plainText = getPlainText(text);
  // Match a word (letters/numbers) followed by space or punctuation
  return /\w+[\s.,!?;:'"-]/.test(plainText) || (/\w+$/.test(plainText) && plainText.includes(' '));
}

/**
 * Hook for auto-saving drafts to Firestore with debouncing.
 *
 * Timing strategy (proven in modernsalon):
 * - 300ms debounce on saves to prevent rapid Firestore writes while typing
 * - Load draft once on mount (not on every change) to prevent overwrites
 * - isInitialized flag prevents sync during initial load
 * - Only save after first complete word (word + space/punctuation)
 */
export function useDraft(
  userId: string | undefined,
  draftKey: string,
  options: UseDraftOptions = {}
): UseDraftReturn {
  const { debounceMs = 300 } = options;

  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasDraft, setHasDraft] = useState(false);

  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load draft from Firestore on mount (only once)
  useEffect(() => {
    async function loadDraft() {
      console.log('[useDraft] Loading draft for userId:', userId, 'key:', draftKey);
      if (!userId) {
        console.log('[useDraft] No userId, skipping load');
        setIsLoading(false);
        setIsInitialized(true);
        return;
      }

      try {
        const draftRef = doc(db, `users/${userId}/drafts`, draftKey);
        const draftSnap = await getDoc(draftRef);

        if (draftSnap.exists()) {
          const data = draftSnap.data() as DraftData;
          console.log('[useDraft] Loaded existing draft:', data.content?.substring(0, 50));
          setContent(data.content || '');
          setTags(data.detectedTags || []);
          setHasDraft(!!data.content);
          if (data.updatedAt) {
            setLastSaved(data.updatedAt.toDate());
          }
        } else {
          console.log('[useDraft] No existing draft found');
        }
      } catch (error) {
        console.error('[useDraft] Error loading draft:', error);
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
        console.log('[useDraft] Initialization complete');
      }
    }

    if (!isInitialized) {
      loadDraft();
    }
  }, [userId, draftKey, isInitialized]);

  // Save draft to Firestore with debounce
  useEffect(() => {
    if (!isInitialized || !userId) {
      console.log('[useDraft] Skipping save - isInitialized:', isInitialized, 'userId:', userId);
      return;
    }

    // Clear any pending sync
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Debounce the sync to prevent rapid updates while typing
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        const draftRef = doc(db, `users/${userId}/drafts`, draftKey);

        if (isContentEmpty(content)) {
          // Content is empty - delete draft if we had one
          if (hasDraft) {
            await deleteDoc(draftRef);
            console.log('[useDraft] Empty content, draft deleted');
            setHasDraft(false);
            setLastSaved(null);
          }
        } else if (hasDraft || hasCompleteWord(content)) {
          // Save if we already have a draft (continue saving updates)
          // OR if this is the first save and we have a complete word
          await setDoc(draftRef, {
            content,
            detectedTags: tags,
            updatedAt: Timestamp.now(),
          });
          console.log('[useDraft] Draft saved successfully');
          setLastSaved(new Date());
          setHasDraft(true);
        } else {
          console.log('[useDraft] Waiting for complete word before first save');
        }
      } catch (error) {
        console.error('[useDraft] Error saving draft:', error);
      }
    }, debounceMs);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [content, tags, userId, draftKey, debounceMs, isInitialized, hasDraft]);

  const setDraftContent = useCallback((newContent: string) => {
    setContent(newContent);
  }, []);

  const setDraftTags = useCallback((newTags: string[]) => {
    setTags(newTags);
  }, []);

  const clearDraft = useCallback(async () => {
    if (!userId) return;

    // Clear pending saves
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    try {
      const draftRef = doc(db, `users/${userId}/drafts`, draftKey);
      await deleteDoc(draftRef);
    } catch (error) {
      console.error('Error clearing draft:', error);
    }

    setContent('');
    setTags([]);
    setHasDraft(false);
    setLastSaved(null);
  }, [userId, draftKey]);

  return {
    draftContent: content,
    draftTags: tags,
    setDraftContent,
    setDraftTags,
    clearDraft,
    isLoading,
    hasDraft,
    lastSaved,
  };
}
