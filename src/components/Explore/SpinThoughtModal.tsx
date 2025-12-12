import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { STYLE_OPTIONS } from './SpinYarnSection';
import { Thought } from '../../types';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Filter out "Your Voice" and "Write your own" - only allow genre styles
const RETELL_STYLE_OPTIONS = STYLE_OPTIONS.filter(
  (opt) => opt.value !== 'yourVoice' && opt.value !== 'custom'
);

interface SpinThoughtModalProps {
  thought: Thought;
  onClose: () => void;
}

interface RetellResult {
  style: string;
  label: string;
  content: string;
}

const SpinThoughtModal: React.FC<SpinThoughtModalProps> = ({
  thought,
  onClose,
}) => {
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<RetellResult[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStyleToggle = (styleValue: string) => {
    setSelectedStyles((prev) =>
      prev.includes(styleValue)
        ? prev.filter((s) => s !== styleValue)
        : [...prev, styleValue]
    );
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Convert HTML content to plain text for the API
  const getPlainTextContent = (html: string): string => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
  };

  const handleRetell = async () => {
    if (selectedStyles.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const functions = getFunctions();
      const spinThought = httpsCallable(functions, 'spinThought', {
        timeout: 120000, // Match server timeout of 120 seconds
      });

      const plainTextContent = getPlainTextContent(thought.content);

      const response = await spinThought({
        thoughtContent: plainTextContent,
        styles: selectedStyles,
      });

      const data = response.data as { results: Record<string, string> };

      // Build results array with labels
      const resultsArray: RetellResult[] = selectedStyles.map((styleValue) => {
        const option = RETELL_STYLE_OPTIONS.find((o) => o.value === styleValue);
        return {
          style: styleValue,
          label: option?.label || styleValue,
          content: data.results[styleValue] || 'Error generating content',
        };
      });

      setResults(resultsArray);
    } catch (err) {
      console.error('Error retelling thought:', err);
      setError('Failed to retell thought. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyTable = async () => {
    // Build plain text version
    let plainText = `*Style: Original*\n${getPlainTextContent(thought.content)}`;

    results.forEach((result) => {
      plainText += `\n\n*Style: ${result.label}*\n${result.content}`;
    });

    // Build HTML version for rich text paste
    let html = `<table style="border-collapse: collapse; width: 100%;"><tbody>`;
    html += `<tr><td style="border: 1px solid #6b7280; padding: 12px;"><strong>Style: Original</strong><br/>${thought.content}</td></tr>`;

    results.forEach((result) => {
      html += `<tr><td style="border: 1px solid #6b7280; padding: 12px;"><strong>Style: ${result.label}</strong><br/>${result.content}</td></tr>`;
    });

    html += `</tbody></table>`;

    try {
      const clipboardItem = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([clipboardItem]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback to plain text
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Normalize HTML content for display
  const normalizeContent = (html: string): string => {
    if (html.includes('<p>')) {
      return html;
    }
    let normalized = html;
    normalized = normalized.replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '</p><p>');
    normalized = normalized.replace(/<br\s*\/?>/gi, '</p><p>');
    if (!normalized.startsWith('<p>')) {
      normalized = '<p>' + normalized;
    }
    if (!normalized.endsWith('</p>')) {
      normalized = normalized + '</p>';
    }
    normalized = normalized.replace(/<p>\s*<\/p>/gi, '');
    return normalized || '<p></p>';
  };

  return (
    <div className="yarn-modal-overlay" onClick={handleOverlayClick}>
      <div className="yarn-modal spin-thought-modal">
        <div className="yarn-modal-header">
          <h3>Spin this Thought</h3>
          <button className="yarn-close-button" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="yarn-modal-content">
          {!loading && results.length === 0 && (
            <>
              <p className="spin-thought-instructions">
                Select the styles you'd like to see this thought retold in:
              </p>
              <div className="spin-thought-toggle-buttons">
                <button
                  type="button"
                  className="spin-thought-toggle-btn"
                  onClick={() => setSelectedStyles(RETELL_STYLE_OPTIONS.map(o => o.value))}
                >
                  All On
                </button>
                <button
                  type="button"
                  className="spin-thought-toggle-btn"
                  onClick={() => setSelectedStyles([])}
                >
                  All Off
                </button>
              </div>
              <div className="style-chips spin-thought-chips">
                {RETELL_STYLE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`style-chip ${
                      selectedStyles.includes(option.value) ? 'active' : ''
                    }`}
                    onClick={() => handleStyleToggle(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {loading && (
            <div className="yarn-loading">
              <div className="yarn-spinner"></div>
              <p>Retelling...</p>
            </div>
          )}

          {error && <div className="spin-thought-error">{error}</div>}

          {!loading && results.length > 0 && (
            <div className="spin-thought-results">
              <div className="spin-thought-table-wrapper">
              <table className="spin-thought-table">
                <tbody>
                  <tr>
                    <td className="spin-thought-cell">
                      <strong>Style: Original</strong>
                      <div
                        className="spin-thought-content"
                        dangerouslySetInnerHTML={{
                          __html: normalizeContent(thought.content),
                        }}
                      />
                    </td>
                  </tr>
                  {results.map((result) => (
                    <tr key={result.style}>
                      <td className="spin-thought-cell">
                        <strong>Style: {result.label}</strong>
                        <div className="spin-thought-content">
                          <ReactMarkdown>{result.content}</ReactMarkdown>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>

        <div className="yarn-modal-actions">
          {!loading && results.length === 0 && (
            <button
              className="yarn-action-button yarn-regenerate-button"
              onClick={handleRetell}
              disabled={selectedStyles.length === 0}
            >
              Retell this Thought
            </button>
          )}
          {!loading && results.length > 0 && (
            <>
              <button
                className="yarn-action-button yarn-copy-button"
                onClick={handleCopyTable}
              >
                {copied ? 'Copied!' : 'Copy Table'}
              </button>
              <button
                className="yarn-action-button yarn-regenerate-button"
                onClick={() => {
                  setResults([]);
                  setSelectedStyles([]);
                }}
              >
                Start Over
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpinThoughtModal;
