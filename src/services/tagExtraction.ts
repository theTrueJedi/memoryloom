/**
 * Extract #tags from text content
 * Tags can contain letters, numbers, hyphens, and underscores
 * Examples: #work, #self-care, #idea_2024
 */
export const extractTags = (text: string): string[] => {
  const tagRegex = /#([a-zA-Z0-9_-]+)/g;
  const matches = text.matchAll(tagRegex);
  const tags = Array.from(matches, (match) => match[1]); // Preserve original capitalization

  // Remove duplicates while preserving case (first occurrence wins)
  const uniqueTags = new Map<string, string>();
  tags.forEach(tag => {
    const lowerTag = tag.toLowerCase();
    if (!uniqueTags.has(lowerTag)) {
      uniqueTags.set(lowerTag, tag);
    }
  });

  return Array.from(uniqueTags.values());
};

/**
 * Insert a tag into text at cursor position
 */
export const insertTag = (text: string, cursorPosition: number, tag: string): { newText: string; newCursorPosition: number } => {
  const tagText = `#${tag}`;
  const before = text.slice(0, cursorPosition);
  const after = text.slice(cursorPosition);

  // Add space before tag if needed
  const needsSpaceBefore = before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n');
  const prefix = needsSpaceBefore ? ' ' : '';

  // Add space after tag if needed
  const needsSpaceAfter = after.length > 0 && !after.startsWith(' ') && !after.startsWith('\n');
  const suffix = needsSpaceAfter ? ' ' : '';

  const newText = before + prefix + tagText + suffix + after;
  const newCursorPosition = cursorPosition + prefix.length + tagText.length + suffix.length;

  return { newText, newCursorPosition };
};

/**
 * Remove a tag from text
 */
export const removeTag = (text: string, tag: string): string => {
  const tagPattern = new RegExp(`#${tag}\\b`, 'gi');
  return text.replace(tagPattern, '').replace(/\s+/g, ' ').trim();
};

/**
 * Remove all hashtags from text content
 */
export const stripTags = (text: string): string => {
  const tagRegex = /#[a-zA-Z0-9_-]+/g;
  return text.replace(tagRegex, '').replace(/\s+/g, ' ').trim();
};
