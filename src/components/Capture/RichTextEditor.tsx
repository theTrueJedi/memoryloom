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
    if (quillRef.current && onKeyDown) {
      const editor = quillRef.current.getEditor();
      const editorElement = editor.root;

      const handleKeyDown = (e: KeyboardEvent) => {
        // Convert KeyboardEvent to React.KeyboardEvent-like object
        const reactEvent = {
          key: e.key,
          metaKey: e.metaKey,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          preventDefault: () => e.preventDefault(),
        };
        onKeyDown(reactEvent);
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
      ['clean']
    ],
  };

  const formats = [
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet', 'indent'
  ];

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
