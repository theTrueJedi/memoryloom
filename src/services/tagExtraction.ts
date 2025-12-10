/**
 * Extract #tags from text content
 * Tags can contain letters (any language), numbers, hyphens, and underscores
 * Examples: #work, #self-care, #idea_2024, #工作, #日记
 */
export const extractTags = (text: string): string[] => {
  // \p{L} matches any letter from any language (Unicode)
  const tagRegex = /#([\p{L}\p{N}_-]+)/gu;
  const matches = text.matchAll(tagRegex);
  const tags = Array.from(matches, (match) => match[1]); // Preserve original

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
 * Remove a tag from text while preserving whitespace/indentation
 */
export const removeTag = (text: string, tag: string): string => {
  // Escape special regex characters in the tag
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Use Unicode-aware boundary matching
  const tagPattern = new RegExp(`#${escapedTag}(?![\\p{L}\\p{N}_-])`, 'giu');
  // Only clean up multiple spaces on the same line (not newlines or indentation)
  return text.replace(tagPattern, '').replace(/ +/g, ' ').trim();
};

/**
 * Remove all hashtags from text content while preserving whitespace/indentation
 */
export const stripTags = (text: string): string => {
  // \p{L} matches any letter from any language (Unicode)
  const tagRegex = /#[\p{L}\p{N}_-]+/gu;
  // Only clean up multiple spaces on the same line (not newlines or indentation)
  return text.replace(tagRegex, '').replace(/ +/g, ' ').trim();
};
