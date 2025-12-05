import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, getDocs, updateDoc, doc, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { analyzeSentiment } from '../../services/gemini';

interface MigrationProgress {
  total: number;
  processed: number;
  failed: number;
  currentThought: string;
  errors: Array<{ id: string; error: string }>;
}

type DateRangePreset = 'all' | 'today' | 'custom';

const SentimentMigration: React.FC = () => {
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangePreset>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

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

  const runMigration = async () => {
    if (!user) {
      alert('You must be logged in to run migration');
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

    if (!confirm(`This will re-analyze sentiment for ${rangeLabel}. This may take several minutes and use API credits. Continue?`)) {
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

      // All thoughts in this collection belong to the user
      const userThoughts = snapshot.docs;

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

          // Re-analyze sentiment
          const newSentiment = await analyzeSentiment(thought.content);

          // Update the thought document
          await updateDoc(doc(db, `users/${user.uid}/thoughts`, thoughtId), {
            sentiment: newSentiment,
          });

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
      console.error('Migration error:', error);
      alert('Migration failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setIsRunning(false);
    }
  };

  if (!user) {
    return (
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        Please log in to access migration tools.
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

          <button
            className="button-primary"
            onClick={runMigration}
            style={{ width: '100%' }}
          >
            Start Migration
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
              <span>{Math.round((progress.processed / progress.total) * 100)}%</span>
            </div>
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: 'var(--border-light)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${(progress.processed / progress.total) * 100}%`,
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
            <h3 style={{ marginBottom: '1rem' }}>✅ Migration Complete!</h3>
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

export default SentimentMigration;
