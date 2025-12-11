import React, { useRef, useEffect, useState, useCallback } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: string;
  onKeyDown?: (event: any) => void;
  tags?: string[]; // Available tags for autocomplete
}

interface AutocompleteState {
  isOpen: boolean;
  searchTerm: string;
  startIndex: number; // Position where # was typed
  position: { top: number; left: number };
  selectedIndex: number;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = "What's on your mind?",
  disabled = false,
  minHeight = '100px',
  onKeyDown,
  tags = [],
}) => {
  const quillRef = useRef<ReactQuill>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [autocomplete, setAutocomplete] = useState<AutocompleteState>({
    isOpen: false,
    searchTerm: '',
    startIndex: 0,
    position: { top: 0, left: 0 },
    selectedIndex: 0,
  });

  // Filter tags based on search term - must START with the search term
  const filteredTags = tags.filter(tag =>
    tag.toLowerCase().startsWith(autocomplete.searchTerm.toLowerCase())
  );

  // Close autocomplete
  const closeAutocomplete = useCallback(() => {
    setAutocomplete(prev => ({ ...prev, isOpen: false, searchTerm: '', selectedIndex: 0 }));
  }, []);

  // Use refs to track current state for event handlers (avoids stale closures)
  const autocompleteRef = useRef(autocomplete);
  const filteredTagsRef = useRef(filteredTags);
  useEffect(() => {
    autocompleteRef.current = autocomplete;
    filteredTagsRef.current = filteredTags;
  }, [autocomplete, filteredTags]);

  // Insert selected tag
  const insertTag = useCallback((tagName: string) => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return;

    // Use ref to get current state (avoids stale closure)
    const { startIndex, searchTerm } = autocompleteRef.current;

    // Delete the # and any typed characters after it
    const deleteLength = 1 + searchTerm.length; // # + search term
    editor.deleteText(startIndex, deleteLength);
    // Insert the full tag with #
    editor.insertText(startIndex, `#${tagName} `);
    // Move cursor to end of inserted tag
    editor.setSelection(startIndex + tagName.length + 2, 0); // +2 for # and space

    closeAutocomplete();
  }, [closeAutocomplete]);

  useEffect(() => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      const editorElement = editor.root;

      // Set minimum height
      editorElement.style.minHeight = minHeight;

      // Auto-expand functionality
      const adjustHeight = () => {
        editorElement.style.height = 'auto';
        editorElement.style.height = Math.max(
          parseInt(minHeight),
          editorElement.scrollHeight
        ) + 'px';
      };

      // Adjust on content change
      editor.on('text-change', adjustHeight);

      // Initial adjustment
      setTimeout(adjustHeight, 0);

      // Cleanup
      return () => {
        editor.off('text-change', adjustHeight);
      };
    }
  }, [minHeight]);

  // Modules config - stable reference
  const modules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      ['link'],
      ['clean']
    ],
  };

  const formats = [
    'bold', 'italic', 'underline', 'strike',
    'list', 'indent', 'link'
  ];

  // Get cursor position for dropdown placement
  const getCursorPosition = useCallback(() => {
    const editor = quillRef.current?.getEditor();
    if (!editor) return { top: 0, left: 0 };

    const selection = editor.getSelection();
    if (!selection) return { top: 0, left: 0 };

    const bounds = editor.getBounds(selection.index);
    const containerRect = containerRef.current?.getBoundingClientRect();
    const editorContainer = editor.root.parentElement;
    const editorRect = editorContainer?.getBoundingClientRect();

    if (!bounds || !containerRect || !editorRect) return { top: 0, left: 0 };

    return {
      top: bounds.top + bounds.height + (editorRect.top - containerRect.top) + 4,
      left: bounds.left + (editorRect.left - containerRect.left),
    };
  }, []);

  // Handle text changes for autocomplete detection
  useEffect(() => {
    if (!quillRef.current) return;

    const editor = quillRef.current.getEditor();

    const handleTextChange = (_delta: any, _oldDelta: any, source: string) => {
      if (source !== 'user') return;

      const selection = editor.getSelection();
      if (!selection) {
        closeAutocomplete();
        return;
      }

      // Get text before cursor
      const text = editor.getText(0, selection.index);

      // Find the last # that might be starting a tag
      const lastHashIndex = text.lastIndexOf('#');

      if (lastHashIndex === -1) {
        closeAutocomplete();
        return;
      }

      // Get text between # and cursor
      const afterHash = text.substring(lastHashIndex + 1);

      // Check if there's a space or newline between # and cursor (tag completed or cancelled)
      if (/[\s\n]/.test(afterHash)) {
        closeAutocomplete();
        return;
      }

      // Check if # is at start or preceded by whitespace (valid tag start)
      const charBeforeHash = lastHashIndex > 0 ? text[lastHashIndex - 1] : ' ';
      if (!/[\s\n]/.test(charBeforeHash) && lastHashIndex !== 0) {
        closeAutocomplete();
        return;
      }

      // Valid tag autocomplete context
      const position = getCursorPosition();
      setAutocomplete({
        isOpen: true,
        searchTerm: afterHash,
        startIndex: lastHashIndex,
        position,
        selectedIndex: 0,
      });
    };

    editor.on('text-change', handleTextChange);

    // Also handle selection change to close autocomplete when clicking elsewhere
    const handleSelectionChange = (range: any) => {
      if (!range) {
        closeAutocomplete();
      }
    };
    editor.on('selection-change', handleSelectionChange);

    return () => {
      editor.off('text-change', handleTextChange);
      editor.off('selection-change', handleSelectionChange);
    };
  }, [closeAutocomplete, getCursorPosition]);

  // Handle keyboard navigation in autocomplete
  useEffect(() => {
    if (!quillRef.current) return;

    const editor = quillRef.current.getEditor();
    const editorElement = editor.root;

    const handleAutocompleteKeyDown = (e: KeyboardEvent) => {
      const currentAutocomplete = autocompleteRef.current;
      const currentFilteredTags = filteredTagsRef.current;

      if (!currentAutocomplete.isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setAutocomplete(prev => ({
          ...prev,
          selectedIndex: Math.min(prev.selectedIndex + 1, currentFilteredTags.length - 1),
        }));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setAutocomplete(prev => ({
          ...prev,
          selectedIndex: Math.max(prev.selectedIndex - 1, 0),
        }));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (currentFilteredTags.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          insertTag(currentFilteredTags[currentAutocomplete.selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeAutocomplete();
      }
    };

    editorElement.addEventListener('keydown', handleAutocompleteKeyDown);

    return () => {
      editorElement.removeEventListener('keydown', handleAutocompleteKeyDown);
    };
  }, [insertTag, closeAutocomplete]);

  // Handle markdown shortcuts and other keyboard shortcuts
  useEffect(() => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      const editorElement = editor.root;

      const handleKeyDown = (e: KeyboardEvent) => {
        // Skip if autocomplete is handling this
        if (autocomplete.isOpen && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
          return;
        }

        // Handle Cmd+] / Ctrl+] for indent
        if ((e.metaKey || e.ctrlKey) && e.key === ']') {
          e.preventDefault();
          const range = editor.getSelection();
          if (range) {
            editor.format('indent', '+1');
          }
          return;
        }

        // Handle Cmd+[ / Ctrl+[ for outdent
        if ((e.metaKey || e.ctrlKey) && e.key === '[') {
          e.preventDefault();
          const range = editor.getSelection();
          if (range) {
            editor.format('indent', '-1');
          }
          return;
        }

        // Handle Cmd+K / Ctrl+K for link insertion
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          const range = editor.getSelection();
          if (range) {
            const format = editor.getFormat(range);
            const currentLink = (format.link as string) || '';
            const url = prompt('Enter URL:', currentLink || 'https://');
            if (url !== null && url !== '') {
              editor.format('link', url);
            } else if (url === '') {
              editor.format('link', false);
            }
          }
          return;
        }

        // Convert KeyboardEvent to React.KeyboardEvent-like object for parent handler
        if (onKeyDown) {
          const reactEvent = {
            key: e.key,
            metaKey: e.metaKey,
            ctrlKey: e.ctrlKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            preventDefault: () => e.preventDefault(),
          };
          onKeyDown(reactEvent);
        }
      };

      editorElement.addEventListener('keydown', handleKeyDown);

      return () => {
        editorElement.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [onKeyDown, autocomplete.isOpen]);

  // Handle markdown shortcuts
  useEffect(() => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();

      const handleTextChange = (_delta: any, _oldDelta: any, source: string) => {
        if (source !== 'user') return;

        const selection = editor.getSelection();
        if (!selection) return;

        const [line, offset] = editor.getLine(selection.index);
        if (!line) return;

        const text = line.domNode.textContent || '';
        const beforeCursor = text.substring(0, offset);

        // Check for bullet list pattern at start of line
        const bulletPattern = /^-\s$/;
        if (bulletPattern.test(beforeCursor)) {
          const startIndex = selection.index - 2;
          editor.deleteText(startIndex, 2);
          editor.formatLine(startIndex, 1, 'list', 'bullet');
          return;
        }

        // Check for markdown patterns followed by space or punctuation
        const boldPattern = /\*([^*]+)\*(\s|[,.:;!?])$/;
        const italicPattern = /_([^_]+)_(\s|[,.:;!?])$/;

        let match;
        let format: 'bold' | 'italic' | null = null;
        let matchLength = 0;

        if ((match = beforeCursor.match(boldPattern))) {
          format = 'bold';
          matchLength = match[0].length;
        } else if ((match = beforeCursor.match(italicPattern))) {
          format = 'italic';
          matchLength = match[0].length;
        }

        if (match && format) {
          const matchText = match[1];
          const trailingChar = match[2];
          const startIndex = selection.index - matchLength;

          editor.deleteText(startIndex, matchLength);
          editor.insertText(startIndex, matchText, { [format]: true });
          editor.insertText(startIndex + matchText.length, trailingChar, { [format]: false });

          const newCursorPos = startIndex + matchText.length + 1;
          editor.setSelection(newCursorPos, 0);
          editor.format(format, false);
        }
      };

      editor.on('text-change', handleTextChange);

      return () => {
        editor.off('text-change', handleTextChange);
      };
    }
  }, []);

  return (
    <div className="rich-text-editor-wrapper" ref={containerRef}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        readOnly={disabled}
      />

      {/* Tag Autocomplete Dropdown */}
      {autocomplete.isOpen && filteredTags.length > 0 && (
        <div
          className="tag-autocomplete-dropdown"
          style={{
            position: 'absolute',
            top: autocomplete.position.top,
            left: autocomplete.position.left,
          }}
          onMouseDown={(e) => e.preventDefault()} // Prevent blur on editor
        >
          {filteredTags.map((tag, index) => (
            <div
              key={tag}
              className={`tag-autocomplete-option ${index === autocomplete.selectedIndex ? 'selected' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur
                insertTag(tag);
              }}
              onMouseEnter={() => setAutocomplete(prev => ({ ...prev, selectedIndex: index }))}
            >
              #{tag}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RichTextEditor;
