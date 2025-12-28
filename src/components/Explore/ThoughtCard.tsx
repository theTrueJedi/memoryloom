import React, { useState, useRef, useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Thought, EmotionLabel } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useThoughts } from '../../hooks/useThoughts';
import { useTags } from '../../hooks/useTags';
import ThoughtTagSuggestions from './ThoughtTagSuggestions';
import RichTextEditor from '../Capture/RichTextEditor';
import TimestampEditor from './TimestampEditor';
import MoodSelector from './MoodSelector';
import {
  getSentimentColor,
  getSentimentEmoji,
} from '../../utils/sentimentUtils';
import SpinThoughtModal from './SpinThoughtModal';

// Normalize HTML content to use consistent paragraph structure
const normalizeContent = (html: string): string => {
  // If content already has proper <p> tags (modern Quill format), return as-is
  if (html.includes('<p>')) {
    return html;
  }

  // For legacy content with <br> tags only, convert to paragraphs
  let normalized = html;

  // Convert double <br> to paragraph break
  normalized = normalized.replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '</p><p>');

  // Convert remaining single <br> to paragraph break (legacy format)
  normalized = normalized.replace(/<br\s*\/?>/gi, '</p><p>');

  // Wrap in paragraph tags if not already wrapped
  if (!normalized.startsWith('<p>')) {
    normalized = '<p>' + normalized;
  }
  if (!normalized.endsWith('</p>')) {
    normalized = normalized + '</p>';
  }

  // Clean up any empty paragraphs
  normalized = normalized.replace(/<p>\s*<\/p>/gi, '');

  return normalized || '<p></p>';
};

interface ThoughtCardProps {
  thought: Thought;
  onTagClick?: (tagName: string) => void;
}

const ThoughtCard: React.FC<ThoughtCardProps> = ({ thought, onTagClick }) => {
  const { user } = useAuth();
  const { editThought, removeThought } = useThoughts(user?.uid);
  const { tags: allTags, addTag } = useTags(user?.uid);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [isEditingMood, setIsEditingMood] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(thought.tags);
  const [editedContent, setEditedContent] = useState(thought.content);
  const [newTagInput, setNewTagInput] = useState('');
  const [tagAutocomplete, setTagAutocomplete] = useState({
    isOpen: false,
    selectedIndex: 0,
  });

  // Sync local state when thought.tags changes (e.g., from accepted suggestions)
  React.useEffect(() => {
    setSelectedTags(thought.tags);
  }, [thought.tags]);

  // Secret timestamp editor state
  const [isTimestampEditorOpen, setIsTimestampEditorOpen] = useState(false);
  const [clickCount, setClickCount] = useState(0);
  const lastClickTime = useRef<number>(0);

  // Copy feedback state
  const [showCopied, setShowCopied] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const copyMenuRef = useRef<HTMLDivElement>(null);

  // Sentiment tooltip state
  const [showSentimentTooltip, setShowSentimentTooltip] = useState(false);
  const sentimentRef = useRef<HTMLDivElement>(null);

  // Spin thought modal state
  const [showSpinModal, setShowSpinModal] = useState(false);

  // Filtered tags for autocomplete (exclude already selected, match by prefix)
  const filteredAutocompleteTags = useMemo(() => {
    if (!newTagInput.trim()) return [];
    return allTags
      .filter(tag =>
        tag.name.toLowerCase().startsWith(newTagInput.toLowerCase()) &&
        !selectedTags.includes(tag.name)
      )
      .slice(0, 5);
  }, [newTagInput, allTags, selectedTags]);

  const formatDate = (timestamp: any): string => {
    const date = timestamp.toDate();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const handleTagToggle = (tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName)
        ? prev.filter((t) => t !== tagName)
        : [...prev, tagName]
    );
  };

  const handleAddNewTag = async () => {
    const trimmedTag = newTagInput.trim();
    if (!trimmedTag) return;

    // Check if tag already exists
    const tagExists = allTags.some(
      (tag) => tag.name.toLowerCase() === trimmedTag.toLowerCase()
    );

    if (!tagExists && user?.uid) {
      // Create the new tag
      await addTag(trimmedTag);
    }

    // Add to selected tags if not already selected
    if (!selectedTags.includes(trimmedTag)) {
      setSelectedTags((prev) => [...prev, trimmedTag]);
    }

    setNewTagInput('');
  };

  const handleSaveTags = async () => {
    // Update tag usage counts for newly added tags
    const newTags = selectedTags.filter(tag => !thought.tags.includes(tag));
    if (newTags.length > 0 && user?.uid) {
      // Update usage for each new tag
      for (const tag of newTags) {
        await addTag(tag);
      }
    }

    await editThought(thought.id, { tags: selectedTags });
    setIsEditingTags(false);
    setNewTagInput('');
  };

  const handleCancelEdit = () => {
    setSelectedTags(thought.tags);
    setIsEditingTags(false);
    setNewTagInput('');
  };

  const handleSaveContent = async () => {
    // Trim only leading/trailing newlines, preserve internal whitespace for indentation
    const trimmedContent = editedContent.replace(/^[\r\n]+|[\r\n]+$/g, '');
    await editThought(thought.id, { content: trimmedContent });
    setIsEditingContent(false);
  };

  const handleCancelContentEdit = () => {
    setEditedContent(thought.content);
    setIsEditingContent(false);
  };

  // Select a tag from autocomplete suggestions
  const selectAutocompleteTag = (tagName: string) => {
    if (!selectedTags.includes(tagName)) {
      setSelectedTags(prev => [...prev, tagName]);
    }
    setNewTagInput('');
    setTagAutocomplete({ isOpen: false, selectedIndex: 0 });
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const hasAutocomplete = tagAutocomplete.isOpen && filteredAutocompleteTags.length > 0;

    if (e.key === 'ArrowDown' && hasAutocomplete) {
      e.preventDefault();
      setTagAutocomplete(prev => ({
        ...prev,
        selectedIndex: Math.min(prev.selectedIndex + 1, filteredAutocompleteTags.length - 1),
      }));
    } else if (e.key === 'ArrowUp' && hasAutocomplete) {
      e.preventDefault();
      setTagAutocomplete(prev => ({
        ...prev,
        selectedIndex: Math.max(prev.selectedIndex - 1, 0),
      }));
    } else if ((e.key === 'Enter' || e.key === 'Tab') && hasAutocomplete) {
      e.preventDefault();
      selectAutocompleteTag(filteredAutocompleteTags[tagAutocomplete.selectedIndex].name);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleAddNewTag();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (hasAutocomplete) {
        setTagAutocomplete({ isOpen: false, selectedIndex: 0 });
      } else {
        setNewTagInput('');
      }
    }
  };

  // Secret click detection for timestamp editor
  const handleCardClick = (e: React.MouseEvent) => {
    // Only count clicks on the card itself, not on interactive elements
    const target = e.target as HTMLElement;
    const isInteractiveElement =
      target.tagName === 'BUTTON' ||
      target.tagName === 'INPUT' ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('.thought-tag') ||
      target.closest('.rich-text-editor');

    if (isInteractiveElement) {
      return;
    }

    const now = Date.now();
    const timeSinceLastClick = now - lastClickTime.current;

    // Reset counter if more than 500ms since last click
    if (timeSinceLastClick > 500) {
      setClickCount(1);
    } else {
      const newCount = clickCount + 1;
      setClickCount(newCount);

      // Trigger timestamp editor on 7th click
      if (newCount === 7) {
        setIsTimestampEditorOpen(true);
        setClickCount(0); // Reset counter
      }
    }

    lastClickTime.current = now;
  };

  // Save handler for timestamp editor
  const handleSaveTimestamp = async (newTimestamp: Timestamp) => {
    // Update both timestamp and createdAt fields
    await editThought(thought.id, {
      timestamp: newTimestamp,
      createdAt: newTimestamp,
    });
    setIsTimestampEditorOpen(false);
  };

  // Delete handler
  const handleDeleteThought = async () => {
    if (!window.confirm('Are you sure you want to delete this thought? This action cannot be undone.')) {
      return;
    }

    try {
      await removeThought(thought.id);
    } catch (error) {
      console.error('Error deleting thought:', error);
      alert('Failed to delete thought. Please try again.');
    }
  };

  // Convert Quill's list format to standard HTML
  // Quill uses <ol> with data-list="bullet"|"ordered" attributes
  // Other apps expect proper <ul>/<ol> nesting
  const convertQuillListsToStandardHtml = (html: string): string => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Find all ol elements that contain list items
    const olElements = tempDiv.querySelectorAll('ol');

    olElements.forEach(ol => {
      const items = ol.querySelectorAll('li');
      if (items.length === 0) return;

      // Group consecutive items by their list type and indent level
      const groups: { type: string; indent: number; items: Element[] }[] = [];
      let currentGroup: { type: string; indent: number; items: Element[] } | null = null;

      items.forEach(li => {
        const listType = li.getAttribute('data-list') || 'bullet';
        // Get indent level from class
        let indent = 0;
        for (let i = 1; i <= 8; i++) {
          if (li.classList.contains(`ql-indent-${i}`)) {
            indent = i;
            break;
          }
        }

        // Remove Quill's UI span elements
        const qlUi = li.querySelector('.ql-ui');
        if (qlUi) qlUi.remove();

        if (!currentGroup || currentGroup.type !== listType || currentGroup.indent !== indent) {
          currentGroup = { type: listType, indent, items: [li] };
          groups.push(currentGroup);
        } else {
          currentGroup.items.push(li);
        }
      });

      // Build new list structure
      const fragment = document.createDocumentFragment();
      let currentIndent = 0;
      const listStack: Element[] = [];

      groups.forEach(group => {
        // Create the appropriate list type
        const listTag = group.type === 'ordered' ? 'ol' : 'ul';

        // Handle indent changes
        while (currentIndent > group.indent && listStack.length > 0) {
          listStack.pop();
          currentIndent--;
        }

        // Create new list for this group
        const newList = document.createElement(listTag);

        group.items.forEach(item => {
          const newLi = document.createElement('li');
          newLi.innerHTML = item.innerHTML;
          newList.appendChild(newLi);
        });

        if (listStack.length > 0 && group.indent > 0) {
          // Nest inside the last item of the parent list
          const parentList = listStack[listStack.length - 1];
          const lastLi = parentList.lastElementChild;
          if (lastLi) {
            lastLi.appendChild(newList);
          } else {
            parentList.appendChild(newList);
          }
        } else {
          fragment.appendChild(newList);
        }

        listStack.push(newList);
        currentIndent = group.indent;
      });

      // Replace the original ol with the new structure
      ol.replaceWith(fragment);
    });

    return tempDiv.innerHTML;
  };

  // Convert HTML to plain text with proper formatting for lists and paragraphs
  const convertHtmlToPlainText = (html: string): string => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    const lines: string[] = [];

    const processNode = (node: Node, indent: number = 0) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (text.trim()) {
          return text;
        }
        return '';
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return '';

      const el = node as Element;
      const tagName = el.tagName.toLowerCase();

      // Skip Quill UI elements
      if (el.classList.contains('ql-ui')) return '';

      // Handle list items
      if (tagName === 'li') {
        // Get indent level from Quill classes
        let itemIndent = indent;
        for (let i = 1; i <= 8; i++) {
          if (el.classList.contains(`ql-indent-${i}`)) {
            itemIndent = i;
            break;
          }
        }

        const prefix = '  '.repeat(itemIndent) + '- ';
        const childContent: string[] = [];
        el.childNodes.forEach(child => {
          const result = processNode(child, itemIndent);
          if (result) childContent.push(result);
        });
        lines.push(prefix + childContent.join(''));
        return '';
      }

      // Handle lists (ol/ul)
      if (tagName === 'ol' || tagName === 'ul') {
        el.childNodes.forEach(child => processNode(child, indent));
        return '';
      }

      // Handle paragraphs
      if (tagName === 'p') {
        // Check for empty paragraph (blank line)
        if (el.innerHTML === '<br>' || el.innerHTML === '' || !el.textContent?.trim()) {
          lines.push('');
          return '';
        }

        const childContent: string[] = [];
        el.childNodes.forEach(child => {
          const result = processNode(child, indent);
          if (result) childContent.push(result);
        });
        if (childContent.length > 0) {
          lines.push(childContent.join(''));
        }
        return '';
      }

      // Handle line breaks
      if (tagName === 'br') {
        return '\n';
      }

      // For other elements, process children and return concatenated text
      const childContent: string[] = [];
      el.childNodes.forEach(child => {
        const result = processNode(child, indent);
        if (result) childContent.push(result);
      });
      return childContent.join('');
    };

    tempDiv.childNodes.forEach(node => processNode(node, 0));

    return lines.join('\n').trim();
  };

  const handleCopyThought = async (includeMetadata: boolean) => {
    // Build HTML content - convert Quill format to standard HTML
    let htmlContent = convertQuillListsToStandardHtml(normalizeContent(thought.content));

    // Build plain text version with proper formatting
    const plainText = convertHtmlToPlainText(thought.content);

    let finalPlainText = plainText;
    let finalHtml = htmlContent;

    if (includeMetadata) {
      const tags = thought.tags.map(t => `#${t}`).join(' ');
      const primaryMood = thought.sentiment.label.charAt(0).toUpperCase() + thought.sentiment.label.slice(1);
      const secondaryMood = thought.sentiment.secondaryLabel
        ? thought.sentiment.secondaryLabel.charAt(0).toUpperCase() + thought.sentiment.secondaryLabel.slice(1)
        : null;
      const moods = secondaryMood ? `${primaryMood} | ${secondaryMood}` : primaryMood;

      finalPlainText += '\n---\n';
      if (tags) finalPlainText += `Tags: ${tags}\n`;
      finalPlainText += `Moods: ${moods}`;

      finalHtml += '<hr>';
      if (tags) finalHtml += `<p>Tags: ${tags}</p>`;
      finalHtml += `<p>Moods: ${moods}</p>`;
    }

    try {
      // Use ClipboardItem API to write both HTML and plain text formats
      const clipboardItem = new ClipboardItem({
        'text/html': new Blob([finalHtml], { type: 'text/html' }),
        'text/plain': new Blob([finalPlainText], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([clipboardItem]);
      setShowCopied(true);
      setShowCopyMenu(false);
      setTimeout(() => setShowCopied(false), 1500);
    } catch (error) {
      // Fallback to plain text if ClipboardItem not supported
      console.error('Error copying with rich text, falling back to plain text:', error);
      try {
        await navigator.clipboard.writeText(finalPlainText);
        setShowCopied(true);
        setShowCopyMenu(false);
        setTimeout(() => setShowCopied(false), 1500);
      } catch (fallbackError) {
        console.error('Error copying thought:', fallbackError);
      }
    }
  };

  // Close copy menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (copyMenuRef.current && !copyMenuRef.current.contains(event.target as Node)) {
        setShowCopyMenu(false);
      }
    };

    if (showCopyMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCopyMenu]);

  // Close sentiment tooltip when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sentimentRef.current && !sentimentRef.current.contains(event.target as Node)) {
        setShowSentimentTooltip(false);
      }
    };

    if (showSentimentTooltip) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSentimentTooltip]);

  // Mood change handlers
  const handleSaveMood = async (primary: EmotionLabel, secondary?: EmotionLabel) => {
    const updatedSentiment = {
      ...thought.sentiment,
      label: primary,
      secondaryLabel: secondary,
    };
    await editThought(thought.id, { sentiment: updatedSentiment });
    setIsEditingMood(false);
  };

  const handleCancelMoodEdit = () => {
    setIsEditingMood(false);
  };

  return (
    <div className="thought-card" onClick={handleCardClick}>
      <div className="thought-card-top">
        <div className="thought-card-tags">
          {selectedTags.length > 0 && !isEditingTags && (
            <div className="thought-tags">
              {selectedTags.map((tag) => (
                <span
                  key={tag}
                  className="thought-tag"
                  onClick={() => onTagClick?.(tag)}
                  title="Click to filter by this tag"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="thought-card-meta">
          <span className="thought-date">{formatDate(thought.timestamp)}</span>
          <div
            className="sentiment-indicators"
            ref={sentimentRef}
            onClick={() => setShowSentimentTooltip(!showSentimentTooltip)}
            onMouseEnter={() => setShowSentimentTooltip(true)}
            onMouseLeave={() => setShowSentimentTooltip(false)}
          >
            <div
              className="sentiment-indicator primary"
              style={{ backgroundColor: getSentimentColor(thought.sentiment.label) }}
            >
              {getSentimentEmoji(thought.sentiment.label)}
            </div>
            {thought.sentiment.secondaryLabel && (
              <div
                className="sentiment-indicator secondary"
                style={{ backgroundColor: getSentimentColor(thought.sentiment.secondaryLabel) }}
              >
                {getSentimentEmoji(thought.sentiment.secondaryLabel)}
              </div>
            )}
            {showSentimentTooltip && thought.sentiment.label !== 'processing' && (
              <div className="sentiment-tooltip">
                <div className="sentiment-tooltip-row primary">
                  <div className="sentiment-tooltip-icon-wrapper">
                    <div
                      className="sentiment-tooltip-icon"
                      style={{ backgroundColor: getSentimentColor(thought.sentiment.label) }}
                    >
                      {getSentimentEmoji(thought.sentiment.label)}
                    </div>
                  </div>
                  <span className="sentiment-tooltip-label">
                    {thought.sentiment.label.charAt(0).toUpperCase() + thought.sentiment.label.slice(1)}
                  </span>
                </div>
                {thought.sentiment.secondaryLabel && (
                  <div className="sentiment-tooltip-row secondary">
                    <div className="sentiment-tooltip-icon-wrapper">
                      <div
                        className="sentiment-tooltip-icon"
                        style={{ backgroundColor: getSentimentColor(thought.sentiment.secondaryLabel) }}
                      >
                        {getSentimentEmoji(thought.sentiment.secondaryLabel)}
                      </div>
                    </div>
                    <span className="sentiment-tooltip-label">
                      {thought.sentiment.secondaryLabel.charAt(0).toUpperCase() + thought.sentiment.secondaryLabel.slice(1)}
                    </span>
                  </div>
                )}
              </div>
            )}
            {showSentimentTooltip && thought.sentiment.label === 'processing' && (
              <div className="sentiment-tooltip">
                <div className="sentiment-tooltip-row primary">
                  <div className="sentiment-tooltip-icon-wrapper">
                    <div
                      className="sentiment-tooltip-icon"
                      style={{ backgroundColor: getSentimentColor('processing') }}
                    >
                      {getSentimentEmoji('processing')}
                    </div>
                  </div>
                  <span className="sentiment-tooltip-label">Processing...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {!isEditingContent ? (
        <div
          className="thought-content"
          dangerouslySetInnerHTML={{ __html: normalizeContent(thought.content) }}
        />
      ) : (
        <div className="thought-content-editor">
          <RichTextEditor
            value={editedContent}
            onChange={setEditedContent}
            placeholder="Edit your thought..."
            minHeight="100px"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                handleCancelContentEdit();
              }
            }}
          />
          <div className="thought-content-actions">
            <button className="button-accept" onClick={handleSaveContent}>
              Save
            </button>
            <button className="button-reject" onClick={handleCancelContentEdit}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <ThoughtTagSuggestions thoughtId={thought.id} />

      <div className="thought-tags-section">
        {!isEditingTags && !isEditingContent && !isEditingMood ? (
          <>
            <div className="thought-action-buttons-left">
              <span className="edit-label">Edit:</span>
              <button
                className="edit-tags-button"
                onClick={() => setIsEditingContent(true)}
              >
                Content
              </button>
              <button
                className="edit-tags-button"
                onClick={() => setIsEditingTags(true)}
              >
                Tags
              </button>
              <button
                className="edit-tags-button"
                onClick={() => setIsEditingMood(true)}
              >
                Moods
              </button>
            </div>
            <div className="thought-action-buttons-right">
              <button
                className="spin-thought-button"
                onClick={() => setShowSpinModal(true)}
                title="Spin this thought"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {/* Speech bubble outline */}
                  <g transform="translate(-2,-2)" stroke="currentColor" fill="none">
                    <path d="M 21,11.5 A 8.38,8.38 0 0 1 20.1,15.3 8.5,8.5 0 0 1 12.5,20 8.38,8.38 0 0 1 8.7,19.1 L 3,21 4.9,15.3 A 8.38,8.38 0 0 1 4,11.5 8.5,8.5 0 0 1 8.7,3.9 8.38,8.38 0 0 1 12.5,3 H 13 a 8.48,8.48 0 0 1 8,8 z" />
                  </g>
                  {/* Arrows inside */}
                  <path
                    fill="currentColor"
                    stroke="currentColor"
                    strokeWidth="0.5"
                    d="m 7.841,14.668 c 0.04,-0.021 0.103,-0.067 0.142,-0.101 0.038,-0.035 0.089,-0.107 0.114,-0.16 0.024,-0.053 0.044,-0.145 0.044,-0.205 0,-0.06 -0.02,-0.152 -0.045,-0.205 -0.027,-0.057 -0.19,-0.24 -0.397,-0.445 -0.194,-0.192 -0.352,-0.357 -0.352,-0.367 0,-0.01 1.466,-0.021 3.258,-0.024 l 3.258,-0.007 0.169,-0.057 c 0.093,-0.031 0.24,-0.094 0.328,-0.14 0.088,-0.046 0.232,-0.143 0.32,-0.216 0.089,-0.073 0.21,-0.2 0.271,-0.282 0.06,-0.082 0.147,-0.223 0.193,-0.314 0.046,-0.091 0.106,-0.248 0.133,-0.349 0.044,-0.161 0.051,-0.275 0.061,-0.921 0.008,-0.508 0.003,-0.778 -0.016,-0.867 -0.015,-0.071 -0.051,-0.164 -0.08,-0.206 -0.029,-0.042 -0.095,-0.104 -0.147,-0.138 -0.052,-0.034 -0.143,-0.069 -0.202,-0.077 -0.061,-0.009 -0.147,-0.004 -0.198,0.011 -0.05,0.015 -0.127,0.052 -0.172,0.082 -0.045,0.03 -0.109,0.104 -0.142,0.163 -0.06,0.107 -0.06,0.109 -0.072,0.914 l -0.012,0.807 -0.083,0.153 c -0.045,0.084 -0.128,0.189 -0.183,0.234 -0.055,0.045 -0.153,0.106 -0.218,0.136 l -0.119,0.055 -3.174,0.006 c -1.745,0.004 -3.174,-0.002 -3.174,-0.012 0,-0.01 0.158,-0.176 0.352,-0.368 0.207,-0.205 0.37,-0.389 0.397,-0.445 0.025,-0.053 0.045,-0.143 0.046,-0.2 0,-0.057 -0.017,-0.143 -0.037,-0.193 -0.021,-0.049 -0.067,-0.12 -0.102,-0.158 -0.036,-0.038 -0.105,-0.089 -0.154,-0.114 -0.054,-0.027 -0.139,-0.046 -0.212,-0.046 -0.067,0 -0.162,0.017 -0.212,0.037 -0.06,0.025 -0.36,0.306 -0.916,0.861 -0.464,0.463 -0.849,0.867 -0.878,0.921 -0.034,0.065 -0.051,0.14 -0.051,0.229 0,0.089 0.017,0.164 0.051,0.229 0.029,0.054 0.414,0.458 0.878,0.92 0.556,0.555 0.856,0.836 0.916,0.861 0.049,0.02 0.147,0.037 0.217,0.036 0.07,-0.001 0.16,-0.018 0.2,-0.039 z M 6.287,9.529 c 0.059,-0.028 0.128,-0.069 0.153,-0.091 0.025,-0.023 0.068,-0.084 0.097,-0.137 0.049,-0.092 0.052,-0.137 0.064,-0.903 l 0.012,-0.807 0.083,-0.153 c 0.045,-0.084 0.128,-0.189 0.182,-0.234 0.055,-0.045 0.153,-0.106 0.219,-0.137 l 0.118,-0.054 3.174,-0.007 c 1.746,-0.003 3.174,0.002 3.174,0.012 0,0.011 -0.158,0.176 -0.352,0.368 -0.207,0.205 -0.37,0.389 -0.397,0.445 -0.025,0.053 -0.045,0.143 -0.046,0.2 0,0.057 0.017,0.143 0.037,0.193 0.021,0.049 0.067,0.12 0.102,0.158 0.036,0.038 0.105,0.089 0.155,0.114 0.053,0.028 0.138,0.046 0.211,0.046 0.067,0 0.163,-0.017 0.212,-0.037 0.06,-0.025 0.36,-0.306 0.916,-0.861 0.464,-0.463 0.849,-0.867 0.878,-0.921 0.034,-0.065 0.051,-0.14 0.051,-0.229 0,-0.089 -0.017,-0.164 -0.051,-0.229 -0.029,-0.054 -0.414,-0.458 -0.878,-0.92 -0.556,-0.555 -0.856,-0.837 -0.916,-0.862 -0.05,-0.02 -0.145,-0.037 -0.212,-0.037 -0.073,0 -0.159,0.019 -0.214,0.047 -0.05,0.026 -0.125,0.085 -0.166,0.132 -0.041,0.047 -0.086,0.126 -0.1,0.176 -0.014,0.05 -0.025,0.118 -0.025,0.151 0,0.033 0.012,0.104 0.026,0.157 0.021,0.077 0.103,0.173 0.397,0.471 0.204,0.206 0.371,0.382 0.371,0.391 0,0.009 -1.466,0.02 -3.258,0.023 l -3.258,0.007 -0.169,0.057 c -0.093,0.031 -0.24,0.094 -0.328,0.14 -0.088,0.046 -0.223,0.134 -0.301,0.197 -0.077,0.063 -0.193,0.178 -0.257,0.258 -0.064,0.079 -0.164,0.238 -0.222,0.353 -0.058,0.115 -0.125,0.294 -0.149,0.397 -0.038,0.162 -0.044,0.297 -0.044,0.971 0,0.573 0.008,0.806 0.031,0.869 0.017,0.048 0.065,0.122 0.107,0.165 0.042,0.043 0.108,0.094 0.147,0.114 0.039,0.02 0.126,0.041 0.194,0.047 0.092,0.008 0.151,-0.002 0.232,-0.039 z"
                  />
                </svg>
              </button>
              <div className="copy-button-wrapper" ref={copyMenuRef}>
                <button
                  className="copy-button"
                  onClick={() => setShowCopyMenu(!showCopyMenu)}
                  title="Copy thought"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
                {showCopyMenu && (
                  <div className="popup-menu copy-menu">
                    <button className="popup-menu-item" onClick={() => handleCopyThought(false)}>Copy Thought only</button>
                    <button className="popup-menu-item" onClick={() => handleCopyThought(true)}>Copy Thought, Tags & Moods</button>
                  </div>
                )}
                {showCopied && <span className="copied-tooltip">Copied!</span>}
              </div>
              <button
                className="delete-button"
                onClick={handleDeleteThought}
                title="Delete thought"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            </div>
          </>
        ) : isEditingTags ? (
          <div
            className="tag-editor"
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !tagAutocomplete.isOpen) {
                e.preventDefault();
                handleCancelEdit();
              }
            }}
          >
            <div className="tag-editor-new-tag">
              <div className="tag-editor-input-wrapper">
                <span className="tag-editor-hash">#</span>
                <input
                  type="text"
                  className="tag-editor-input"
                  placeholder="Add new tag..."
                  value={newTagInput}
                  onChange={(e) => {
                    setNewTagInput(e.target.value);
                    setTagAutocomplete({
                      isOpen: e.target.value.trim().length > 0,
                      selectedIndex: 0,
                    });
                  }}
                  onKeyDown={handleTagInputKeyDown}
                />
                {tagAutocomplete.isOpen && filteredAutocompleteTags.length > 0 && (
                  <div className="tag-autocomplete-dropdown">
                    {filteredAutocompleteTags.map((tag, index) => (
                      <div
                        key={tag.name}
                        className={`tag-autocomplete-option ${index === tagAutocomplete.selectedIndex ? 'selected' : ''}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectAutocompleteTag(tag.name);
                        }}
                        onMouseEnter={() => setTagAutocomplete(prev => ({ ...prev, selectedIndex: index }))}
                      >
                        #{tag.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                className="tag-editor-add-button"
                onClick={handleAddNewTag}
                disabled={!newTagInput.trim()}
              >
                Add
              </button>
            </div>
            <div className="tag-editor-grid">
              {allTags.map((tag) => (
                <button
                  key={tag.name}
                  className={`tag-editor-item ${
                    selectedTags.includes(tag.name) ? 'active' : ''
                  }`}
                  onClick={() => handleTagToggle(tag.name)}
                >
                  <span className="tag-name">{tag.name}</span>
                  <span className="tag-checkmark">
                    {selectedTags.includes(tag.name) ? '✓' : '+'}
                  </span>
                </button>
              ))}
            </div>
            <div className="tag-editor-actions">
              <button className="button-accept" onClick={handleSaveTags}>
                Save
              </button>
              <button className="button-reject" onClick={handleCancelEdit}>
                Cancel
              </button>
            </div>
          </div>
        ) : isEditingMood ? (
          <MoodSelector
            currentPrimary={thought.sentiment.label}
            currentSecondary={thought.sentiment.secondaryLabel}
            onSave={handleSaveMood}
            onCancel={handleCancelMoodEdit}
          />
        ) : null}
      </div>

      <TimestampEditor
        thought={thought}
        isOpen={isTimestampEditorOpen}
        onClose={() => setIsTimestampEditorOpen(false)}
        onSave={handleSaveTimestamp}
      />

      {showSpinModal && (
        <SpinThoughtModal
          thought={thought}
          onClose={() => setShowSpinModal(false)}
        />
      )}
    </div>
  );
};

export default ThoughtCard;
