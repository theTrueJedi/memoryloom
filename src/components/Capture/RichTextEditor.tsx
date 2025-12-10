import React, { useRef, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'quill/dist/quill.snow.css';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: string;
  onKeyDown?: (event: any) => void;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = "What's on your mind?",
  disabled = false,
  minHeight = '100px',
  onKeyDown,
}) => {
  const quillRef = useRef<ReactQuill>(null);

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

  // Handle keyboard shortcuts
  useEffect(() => {
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      const editorElement = editor.root;

      const handleKeyDown = (e: KeyboardEvent) => {
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
              // Remove link if empty string
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
  }, [onKeyDown]);

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
          const startIndex = selection.index - 2; // Length of "- "

          // Remove the "- " text
          editor.deleteText(startIndex, 2);

          // Format the line as a bullet list
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
          const trailingChar = match[2]; // The space or punctuation that triggered it
          const startIndex = selection.index - matchLength;

          // Remove the markdown syntax
          editor.deleteText(startIndex, matchLength);

          // Insert the formatted text
          editor.insertText(startIndex, matchText, { [format]: true });

          // Insert trailing character WITHOUT formatting to break the format continuation
          editor.insertText(startIndex + matchText.length, trailingChar, { [format]: false });

          // Move cursor to end and explicitly clear the format
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
    <div className="rich-text-editor-wrapper">
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
    </div>
  );
};

export default RichTextEditor;
