# TODO - Fix Paragraph Spacing

**Status**: Partially Fixed, Still Needs Work

## Problem
The paragraph spacing between thoughts is inconsistent:
- Some thoughts show large gaps (~1.5x line height) between paragraphs
- Others show small gaps (~25% of line height)
- Goal: Achieve consistent 50% line-height spacing (0.75em) across all thoughts

## Current Implementation
- CSS: `.thought-content p` has `margin: 0 0 0.75em 0`
- CSS: Empty `<p>` and `<p><br></p>` tags have `margin: 0` via:
  ```css
  .thought-content p:empty,
  .thought-content p:has(> br:only-child) {
    margin: 0;
  }
  ```
- Normalization function in `ThoughtCard.tsx` converts legacy `<br>` tags to `<p>` tags

## Observed Behavior
Despite the CSS fix for `<p><br></p>`, spacing is still inconsistent across different thoughts.

Example HTML structures found:
- **Large gaps**: `<p>Text...</p><p><br></p><p>More text...</p>`
- **Small gaps**: `<p>Text...</p><p>More text...</p>`

## Potential Issues to Investigate
1. Whether all `<p><br></p>` cases are being caught by the `:has(> br:only-child)` selector
2. If there are other HTML structures causing the inconsistency (e.g., `<p> </p>`, `<p>&nbsp;</p>`)
3. Browser compatibility with `:has()` selector
4. Whether Quill is generating different HTML structures in different contexts

## Files Involved
- `src/components/Explore/ThoughtCard.tsx` - `normalizeContent()` function (line 11-39)
- `src/styles/theme.css` - `.thought-content p` styles (line 860-867)

## Next Steps
1. Add more comprehensive logging to see exact HTML structures causing issues
2. Consider expanding CSS selectors to catch more edge cases
3. Test `:has()` selector browser compatibility
4. Possibly normalize ALL content (even modern Quill content) to ensure consistency
