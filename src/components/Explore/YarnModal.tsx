import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface YarnModalProps {
  tagName: string;
  content: string;
  loading: boolean;
  onClose: () => void;
  onRegenerate: () => void;
}

const YarnModal: React.FC<YarnModalProps> = ({
  tagName,
  content,
  loading,
  onClose,
  onRegenerate,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="yarn-modal-overlay" onClick={handleOverlayClick}>
      <div className="yarn-modal">
        <div className="yarn-modal-header">
          <h3>#{tagName}</h3>
          <button className="yarn-close-button" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="yarn-modal-content">
          {loading ? (
            <div className="yarn-loading">
              <div className="yarn-spinner"></div>
              <p>Spinning your yarn...</p>
            </div>
          ) : (
            <div className="yarn-text">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>

        {!loading && content && (
          <div className="yarn-modal-actions">
            <button
              className="yarn-action-button yarn-copy-button"
              onClick={handleCopy}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              className="yarn-action-button yarn-regenerate-button"
              onClick={onRegenerate}
            >
              Regenerate
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default YarnModal;
