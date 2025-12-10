import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { analyzeSentiment, suggestTags } from '../../services/gemini';
import { createTagSuggestion, getAllTags, updateThought } from '../../services/firestore';
import { Tag } from '../../types';

interface ReprocessingProgress {
  total: number;
  processed: number;
  failed: number;
  currentThought: string;
  errors: Array<{ id: string; error: string }>;
}

type DateRangePreset = 'all' | 'today' | 'custom';

interface ReprocessingOptions {
  sentiment: boolean;
  tags: boolean;
}

const ThoughtReprocessing: React.FC = () => {
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<ReprocessingProgress | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangePreset>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [options, setOptions] = useState<ReprocessingOptions>({
    sentiment: true,
    tags: false,
  });

  // Helper to format date as YYYY-MM-DD for input
  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // Handle preset selection
  const handlePresetChange = (preset: DateRangePreset) => {
    setDateRange(preset);

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const today = formatDateForInput(new Date());
      setStartDate(today);
      setEndDate(today);
    }
    // For 'custom', don't change the dates - let user set them manually
  };

  // When user manually changes dates, switch to custom mode
  const handleDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    setDateRange('custom');
  };

  const handleOptionChange = (option: keyof ReprocessingOptions) => {
    setOptions(prev => ({ ...prev, [option]: !prev[option] }));
  };

  const runReprocessing = async () => {
    if (!user) {
      alert('You must be logged in to run reprocessing');
      return;
    }

    if (!options.sentiment && !options.tags) {
      alert('Please select at least one option to reprocess');
      return;
    }

    // Build confirmation message based on date range
    let rangeLabel = 'ALL your thoughts';
    if (dateRange === 'today') {
      rangeLabel = "today's thoughts";
    } else if (dateRange === 'custom' && startDate && endDate) {
      rangeLabel = `thoughts from ${startDate} to ${endDate}`;
    } else if (dateRange === 'custom' && startDate) {
      rangeLabel = `thoughts from ${startDate} onwards`;
    } else if (dateRange === 'custom' && endDate) {
      rangeLabel = `thoughts up to ${endDate}`;
    }

    const processingTypes = [];
    if (options.sentiment) processingTypes.push('sentiment');
    if (options.tags) processingTypes.push('tag suggestions');

    if (!confirm(`This will reprocess ${processingTypes.join(' and ')} for ${rangeLabel}. This may take several minutes and use API credits. Continue?`)) {
      return;
    }

    setIsRunning(true);
    setIsComplete(false);

    try {
      // Build query based on selected date range
      const thoughtsRef = collection(db, `users/${user.uid}/thoughts`);
      let thoughtsQuery;

      if (dateRange === 'all') {
        // All thoughts - no filter
        thoughtsQuery = thoughtsRef;
      } else {
        // Build date filters
        const filters = [];

        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          filters.push(where('timestamp', '>=', Timestamp.fromDate(start)));
        }

        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          filters.push(where('timestamp', '<=', Timestamp.fromDate(end)));
        }

        thoughtsQuery = filters.length > 0
          ? query(thoughtsRef, ...filters)
          : thoughtsRef;
      }

      const snapshot = await getDocs(thoughtsQuery);
      const userThoughts = snapshot.docs;

      // Get existing tags for tag suggestions
      let existingTags: string[] = [];
      if (options.tags) {
        const tagsData: Tag[] = await getAllTags(user.uid);
        existingTags = tagsData.map((t: Tag) => t.name);
      }

      // Build context for tag suggestions (all thoughts for pattern matching)
      let allThoughtsContext: Array<{ content: string; tags: string[]; sentiment: any }> = [];
      if (options.tags) {
        const allThoughtsSnapshot = await getDocs(thoughtsRef);
        allThoughtsContext = allThoughtsSnapshot.docs.map(d => {
          const data = d.data();
          return {
            content: data.content,
            tags: data.tags || [],
            sentiment: data.sentiment || { score: 0, magnitude: 0.5, label: 'neutral' },
          };
        });
      }

      setProgress({
        total: userThoughts.length,
        processed: 0,
        failed: 0,
        currentThought: '',
        errors: [],
      });

      let processed = 0;
      let failed = 0;
      const errors: Array<{ id: string; error: string }> = [];

      // Process each thought
      for (const thoughtDoc of userThoughts) {
        const thought = thoughtDoc.data();
        const thoughtId = thoughtDoc.id;

        try {
          setProgress(prev => prev ? {
            ...prev,
            currentThought: `${thought.content.substring(0, 100)}...`,
          } : null);

          // Reprocess sentiment if selected
          if (options.sentiment) {
            const newSentiment = await analyzeSentiment(thought.content);

            // Remove undefined fields to avoid Firestore errors
            const sanitizedSentiment: any = {
              score: newSentiment.score,
              magnitude: newSentiment.magnitude,
              label: newSentiment.label,
            };

            // Only add secondaryLabel if it's defined
            if (newSentiment.secondaryLabel !== undefined) {
              sanitizedSentiment.secondaryLabel = newSentiment.secondaryLabel;
            }

            await updateThought(user.uid, thoughtId, { sentiment: sanitizedSentiment });
          }

          // Reprocess tags if selected
          if (options.tags) {
            const suggestions = await suggestTags(
              thought.content,
              existingTags,
              { thoughts: allThoughtsContext }
            );

            // Create suggestions for existing tags
            for (const tag of suggestions.existingTags) {
              if (!thought.tags?.includes(tag)) {
                await createTagSuggestion(
                  user.uid,
                  thoughtId,
                  tag,
                  false,
                  `AI suggested existing tag: ${suggestions.reasoning}`
                );
              }
            }

            // Create suggestion for new tag
            if (suggestions.newTag && !thought.tags?.includes(suggestions.newTag)) {
              await createTagSuggestion(
                user.uid,
                thoughtId,
                suggestions.newTag,
                true,
                `AI suggested new tag: ${suggestions.reasoning}`
              );
            }
          }

          processed++;
          setProgress(prev => prev ? {
            ...prev,
            processed,
          } : null);

          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push({ id: thoughtId, error: errorMessage });

          setProgress(prev => prev ? {
            ...prev,
            failed,
            errors,
          } : null);
        }
      }

      setIsComplete(true);
      setIsRunning(false);

    } catch (error) {
      console.error('Reprocessing error:', error);
      alert('Reprocessing failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setIsRunning(false);
    }
  };

  if (!user) {
    return (
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        Please log in to access reprocessing tools.
      </p>
    );
  }

  return (
    <div>

      {!isRunning && !isComplete && (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>
              Date Range
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <button
                className={`preset-button ${dateRange === 'all' ? 'active' : ''}`}
                onClick={() => handlePresetChange('all')}
                style={{
                  background: dateRange === 'all' ? 'var(--primary-teal)' : 'var(--tag-chip-bg)',
                  color: dateRange === 'all' ? 'white' : 'var(--tag-chip-text)',
                  borderColor: dateRange === 'all' ? 'var(--primary-teal)' : 'var(--tag-chip-border)',
                }}
              >
                All Time
              </button>
              <button
                className={`preset-button ${dateRange === 'today' ? 'active' : ''}`}
                onClick={() => handlePresetChange('today')}
                style={{
                  background: dateRange === 'today' ? 'var(--primary-teal)' : 'var(--tag-chip-bg)',
                  color: dateRange === 'today' ? 'white' : 'var(--tag-chip-text)',
                  borderColor: dateRange === 'today' ? 'var(--primary-teal)' : 'var(--tag-chip-border)',
                }}
              >
                Today
              </button>
            </div>

            <div style={{
              display: 'flex',
              gap: '1rem',
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              <div style={{ flex: '1', minWidth: '150px' }}>
                <label
                  htmlFor="start-date"
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '0.25rem'
                  }}
                >
                  Start Date
                </label>
                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => handleDateChange(e.target.value, endDate)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    outline: 'none',
                    transition: 'border-color var(--transition-base)',
                  }}
                />
              </div>

              <div style={{ flex: '1', minWidth: '150px' }}>
                <label
                  htmlFor="end-date"
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '0.25rem'
                  }}
                >
                  End Date
                </label>
                <input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => handleDateChange(startDate, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    outline: 'none',
                    transition: 'border-color var(--transition-base)',
                  }}
                />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>
              Reprocess Options
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                color: 'var(--text-primary)',
              }}>
                <input
                  type="checkbox"
                  checked={options.sentiment}
                  onChange={() => handleOptionChange('sentiment')}
                  style={{
                    width: '1rem',
                    height: '1rem',
                    accentColor: 'var(--primary-teal)',
                  }}
                />
                Sentiment Analysis
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                  (re-analyze emotional content)
                </span>
              </label>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                color: 'var(--text-primary)',
              }}>
                <input
                  type="checkbox"
                  checked={options.tags}
                  onChange={() => handleOptionChange('tags')}
                  style={{
                    width: '1rem',
                    height: '1rem',
                    accentColor: 'var(--primary-teal)',
                  }}
                />
                Tag Suggestions
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                  (generate new tag recommendations)
                </span>
              </label>
            </div>
          </div>

          <button
            className="button-primary"
            onClick={runReprocessing}
            disabled={!options.sentiment && !options.tags}
            style={{ width: '100%' }}
          >
            Start Reprocessing
          </button>
        </div>
      )}

      {isRunning && progress && (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '0.5rem',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)'
            }}>
              <span>Progress: {progress.processed} / {progress.total}</span>
              <span>{progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0}%</span>
            </div>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'var(--border-light)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${progress.total > 0 ? (progress.processed / progress.total) * 100 : 0}%`,
                height: '100%',
                backgroundColor: 'var(--primary-purple)',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          {progress.currentThought && (
            <div style={{
              padding: '1rem',
              backgroundColor: 'var(--bg-primary)',
              borderRadius: '8px',
              marginBottom: '1rem'
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                Currently processing:
              </div>
              <div style={{ fontSize: '0.875rem', fontStyle: 'italic' }}>
                {progress.currentThought}
              </div>
            </div>
          )}

          {progress.failed > 0 && (
            <div style={{
              padding: '1rem',
              backgroundColor: '#FEE',
              border: '1px solid #F44336',
              borderRadius: '8px',
              marginBottom: '1rem'
            }}>
              <strong>Errors: {progress.failed}</strong>
              <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                {progress.errors.map((err, idx) => (
                  <div key={idx} style={{ marginTop: '0.25rem' }}>
                    • {err.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isComplete && progress && (
        <div>
          <div className="alert alert-success" style={{
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <h3 style={{ marginBottom: '1rem' }}>Reprocessing Complete!</h3>
            <div>
              <p>Successfully processed: {progress.processed} thoughts</p>
              {progress.failed > 0 && <p>Failed: {progress.failed} thoughts</p>}
            </div>
          </div>

          <button
            className="button-secondary"
            onClick={() => window.location.reload()}
            style={{ width: '100%', marginTop: '1rem' }}
          >
            Refresh Page
          </button>
        </div>
      )}
    </div>
  );
};

export default ThoughtReprocessing;
