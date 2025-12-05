import React, { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useThoughts } from '../../hooks/useThoughts';
import { createThought, createTagSuggestion } from '../../services/firestore';
import { analyzeSentiment, suggestTags } from '../../services/gemini';
import {
  fetchSheetData,
  validateSheetData,
  parseDateTime,
  parseTags,
  SheetRow,
  ValidationResult,
} from '../../services/googleSheets';

type ImportStatus = 'idle' | 'fetching' | 'validating' | 'confirming' | 'importing' | 'complete' | 'error';

interface ImportProgress {
  current: number;
  total: number;
  currentThought: string;
  successCount: number;
  errors: Array<{ row: number; thought: string; error: string }>;
}

const SHEET_ID_STORAGE_KEY = 'thoughtloom-last-sheet-id';

const BulkImport: React.FC = () => {
  const { user } = useAuth();
  const { thoughts } = useThoughts(user?.uid);
  const [sheetId, setSheetId] = useState('');
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [detectedRows, setDetectedRows] = useState<SheetRow[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);

  // Load last used sheet ID for this user on mount
  useEffect(() => {
    if (user?.uid) {
      const storageKey = `${SHEET_ID_STORAGE_KEY}-${user.uid}`;
      const savedSheetId = localStorage.getItem(storageKey);
      if (savedSheetId) {
        setSheetId(savedSheetId);
      }
    }
  }, [user?.uid]);

  // Save sheet ID to localStorage when it changes (and is valid)
  useEffect(() => {
    if (user?.uid && sheetId.trim()) {
      const storageKey = `${SHEET_ID_STORAGE_KEY}-${user.uid}`;
      localStorage.setItem(storageKey, sheetId.trim());
    }
  }, [sheetId, user?.uid]);

  /**
   * Converts markdown formatting and newlines to HTML
   * Custom markdown standard: *bold*, _italic_, newlines
   */
  const markdownToHtml = (text: string): string => {
    let html = text;

    // Convert *bold* to <strong> (custom standard)
    html = html.replace(/\*(.+?)\*/g, '<strong>$1</strong>');

    // Convert _italic_ to <em> (custom standard)
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // Convert newlines to <br> tags or <p> tags
    // Split by double newlines for paragraphs
    const paragraphs = html.split(/\n\n+/);
    if (paragraphs.length > 1) {
      // Multiple paragraphs
      html = paragraphs
        .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('');
    } else {
      // Single paragraph with line breaks
      html = `<p>${html.replace(/\n/g, '<br>')}</p>`;
    }

    return html;
  };

  const generateTagSuggestions = async (
    userId: string,
    thoughtId: string,
    content: string,
    existingTagNames: string[]
  ) => {
    try {
      // Build historical context from existing thoughts
      const context = {
        thoughts: thoughts.map(t => ({
          content: t.content,
          tags: t.tags,
          sentiment: t.sentiment,
        }))
      };

      const suggestions = await suggestTags(content, existingTagNames, context);

      // Create suggestion for existing tags
      for (const tag of suggestions.existingTags) {
        if (!existingTagNames.includes(tag)) {
          await createTagSuggestion(
            userId,
            thoughtId,
            tag,
            false,
            `AI suggested existing tag: ${suggestions.reasoning}`
          );
        }
      }

      // Create suggestion for new tag
      if (suggestions.newTag && !existingTagNames.includes(suggestions.newTag)) {
        await createTagSuggestion(
          userId,
          thoughtId,
          suggestions.newTag,
          true,
          `AI suggested new tag: ${suggestions.reasoning}`
        );
      }
    } catch (error) {
      console.error('Error in generateTagSuggestions:', error);
    }
  };

  const handleFetchPreview = async () => {
    if (!user) {
      alert('You must be logged in to import thoughts');
      return;
    }

    if (!sheetId.trim()) {
      alert('Please enter a Google Sheet ID');
      return;
    }

    setStatus('fetching');

    try {
      // Fetch data from Google Sheets
      const rows = await fetchSheetData(sheetId.trim(), 'Import');

      // Validate the data
      setStatus('validating');
      const validation = validateSheetData(rows);

      setDetectedRows(rows);
      setValidationResult(validation);

      if (validation.valid) {
        setStatus('confirming');
      } else {
        setStatus('error');
      }
    } catch (error) {
      console.error('Fetch error:', error);
      alert('Failed to fetch sheet: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setStatus('idle');
    }
  };

  const handleImport = async () => {
    if (!user) {
      alert('You must be logged in to import thoughts');
      return;
    }

    if (!confirm(`Import ${detectedRows.length} thoughts? This will analyze sentiment for each thought and may take several minutes.`)) {
      return;
    }

    setStatus('importing');

    const successes: string[] = [];
    const failures: Array<{ row: number; thought: string; error: string }> = [];

    setProgress({
      current: 0,
      total: detectedRows.length,
      currentThought: '',
      successCount: 0,
      errors: [],
    });

    for (let i = 0; i < detectedRows.length; i++) {
      const row = detectedRows[i];
      const rowNum = i + 2; // +2 because we skip header and are 1-indexed

      try {
        // Update progress
        setProgress((prev) =>
          prev
            ? {
                ...prev,
                current: i + 1,
                currentThought: row.thoughtText.substring(0, 100),
              }
            : null
        );

        // 1. Parse datetime
        const parsedDate = parseDateTime(row.datetime);
        if (!parsedDate) {
          throw new Error('Invalid datetime format');
        }
        const timestamp = Timestamp.fromDate(parsedDate);

        // 2. Parse tags
        const tags = parseTags(row.tags);

        // 3. Convert markdown to HTML and preserve newlines
        const formattedContent = markdownToHtml(row.thoughtText);

        // 4. Analyze sentiment (use original text for better analysis)
        const sentiment = await analyzeSentiment(row.thoughtText);

        // 5. Create thought with custom timestamp (backdating)
        const thoughtRef = await createThought(
          user.uid,
          formattedContent,
          tags,
          sentiment,
          timestamp // Custom timestamp for backdating
        );

        // 6. Generate tag suggestions (async, don't await)
        if (tags.length > 0) {
          generateTagSuggestions(user.uid, thoughtRef, row.thoughtText, tags).catch((err: Error) => {
            console.warn(`Tag suggestion failed for thought ${thoughtRef}:`, err);
          });
        }

        successes.push(thoughtRef);

        setProgress((prev) =>
          prev
            ? {
                ...prev,
                successCount: successes.length,
              }
            : null
        );

        // Rate limiting: 1 second delay between API calls
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        failures.push({
          row: rowNum,
          thought: row.thoughtText.substring(0, 50) + '...',
          error: errorMessage,
        });

        setProgress((prev) =>
          prev
            ? {
                ...prev,
                errors: failures,
              }
            : null
        );

        console.error(`Import error on row ${rowNum}:`, error);
      }
    }

    setStatus('complete');
  };

  const handleReset = () => {
    setSheetId('');
    setStatus('idle');
    setDetectedRows([]);
    setValidationResult(null);
    setProgress(null);
  };

  if (!user) {
    return (
      <div className="card">
        <p>Please log in to import thoughts.</p>
      </div>
    );
  }

  return (
    <div className="bulk-import-container">
      <h3 className="admin-section-title">Bulk Import from Google Sheets</h3>

      {/* Input Section */}
      {status === 'idle' && (
        <div className="import-input-section">
          <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Import multiple thoughts from a Google Sheet. The sheet must be publicly viewable and contain an "Import" tab with three columns:
          </p>
          <ul style={{ marginBottom: '1rem', paddingLeft: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <li><strong>Column A:</strong> Datetime (e.g., "2024-01-15 14:30:00")</li>
            <li><strong>Column B:</strong> Thought Text</li>
            <li><strong>Column C:</strong> Tags (comma-separated, optional)</li>
          </ul>

          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: '8px', fontSize: '0.875rem' }}>
            <strong>How to get your Sheet ID:</strong>
            <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-secondary)' }}>
              From your Google Sheet URL:<br />
              <code style={{ fontSize: '0.75rem' }}>
                https://docs.google.com/spreadsheets/d/<strong style={{ color: 'var(--primary-purple)' }}>SHEET_ID</strong>/edit
              </code>
            </p>
          </div>

          <input
            type="text"
            value={sheetId}
            onChange={(e) => setSheetId(e.target.value)}
            placeholder="Enter Google Sheet ID"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              fontSize: '0.9rem',
              marginBottom: '1rem',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
            }}
          />

          <button className="button-primary" onClick={handleFetchPreview} style={{ width: '100%' }}>
            Fetch Preview
          </button>
        </div>
      )}

      {/* Fetching/Validating Status */}
      {(status === 'fetching' || status === 'validating') && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 1rem' }}></div>
          <p>{status === 'fetching' ? 'Fetching sheet data...' : 'Validating data...'}</p>
        </div>
      )}

      {/* Error State */}
      {status === 'error' && validationResult && (
        <div>
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
            <strong>Validation Errors:</strong>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
              {validationResult.errors.map((error, idx) => (
                <li key={idx}>{error}</li>
              ))}
            </ul>
          </div>
          <button className="button-secondary" onClick={handleReset} style={{ width: '100%' }}>
            Try Again
          </button>
        </div>
      )}

      {/* Preview/Confirmation Section */}
      {status === 'confirming' && validationResult && (
        <div>
          <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
            <strong>Found {detectedRows.length} thoughts to import</strong>
          </div>

          {validationResult.warnings.length > 0 && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.3)', borderRadius: '8px' }}>
              <strong style={{ fontSize: '0.875rem' }}>Warnings:</strong>
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem', fontSize: '0.875rem' }}>
                {validationResult.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <strong style={{ fontSize: '0.875rem', display: 'block', marginBottom: '0.5rem' }}>Preview (first 5 rows):</strong>
            <table className="sheet-preview-table">
              <thead>
                <tr>
                  <th>Datetime</th>
                  <th>Thought</th>
                  <th>Tags</th>
                </tr>
              </thead>
              <tbody>
                {detectedRows.slice(0, 5).map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{row.datetime}</td>
                    <td style={{ fontSize: '0.75rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.thoughtText.substring(0, 60)}
                      {row.thoughtText.length > 60 ? '...' : ''}
                    </td>
                    <td style={{ fontSize: '0.75rem' }}>{row.tags || <em style={{ color: 'var(--text-secondary)' }}>none</em>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {detectedRows.length > 5 && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                ...and {detectedRows.length - 5} more rows
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="button-secondary" onClick={handleReset} style={{ flex: 1 }}>
              Cancel
            </button>
            <button className="button-primary" onClick={handleImport} style={{ flex: 1 }}>
              Confirm Import
            </button>
          </div>
        </div>
      )}

      {/* Import Progress */}
      {status === 'importing' && progress && (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
              <span>Progress: {progress.current} / {progress.total}</span>
              <span>{Math.round((progress.current / progress.total) * 100)}%</span>
            </div>
            <div style={{ height: '8px', background: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  background: 'var(--primary-purple)',
                  width: `${(progress.current / progress.total) * 100}%`,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {progress.currentThought && (
            <div style={{ padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: '8px', marginBottom: '1rem' }}>
              <strong style={{ fontSize: '0.875rem', display: 'block', marginBottom: '0.25rem' }}>Currently processing:</strong>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                {progress.currentThought}
                {progress.currentThought.length >= 100 ? '...' : ''}
              </p>
            </div>
          )}

          {progress.errors.length > 0 && (
            <div className="alert alert-error">
              <strong>Errors ({progress.errors.length}):</strong>
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem', maxHeight: '200px', overflowY: 'auto', fontSize: '0.875rem' }}>
                {progress.errors.map((error, idx) => (
                  <li key={idx}>
                    Row {error.row}: {error.thought} - {error.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Complete State */}
      {status === 'complete' && progress && (
        <div>
          <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
            <strong>Import Complete!</strong>
            <p style={{ marginTop: '0.5rem' }}>
              Successfully imported {progress.successCount} of {progress.total} thoughts
            </p>
          </div>

          {progress.errors.length > 0 && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              <strong>Failed: {progress.errors.length} thoughts</strong>
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem', maxHeight: '200px', overflowY: 'auto', fontSize: '0.875rem' }}>
                {progress.errors.map((error, idx) => (
                  <li key={idx}>
                    Row {error.row}: {error.thought} - {error.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button className="button-primary" onClick={handleReset} style={{ width: '100%' }}>
            Import Another Sheet
          </button>
        </div>
      )}
    </div>
  );
};

export default BulkImport;
