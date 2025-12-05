import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { analyzeSentiment } from '../../services/gemini';

interface MigrationProgress {
  total: number;
  processed: number;
  failed: number;
  currentThought: string;
  errors: Array<{ id: string; error: string }>;
}

const SentimentMigration: React.FC = () => {
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const runMigration = async () => {
    if (!user) {
      alert('You must be logged in to run migration');
      return;
    }

    if (!confirm('This will re-analyze sentiment for ALL your thoughts. This may take several minutes and use API credits. Continue?')) {
      return;
    }

    setIsRunning(true);
    setIsComplete(false);

    try {
      // Get all thoughts for current user
      const thoughtsRef = collection(db, `users/${user.uid}/thoughts`);
      const snapshot = await getDocs(thoughtsRef);

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
      <div className="card">
        <p>Please log in to access migration tools.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: '800px', margin: '2rem auto' }}>
      <h2 className="gradient-text" style={{ marginBottom: '1rem' }}>Sentiment Migration Tool</h2>

      <div style={{ marginBottom: '1.5rem' }}>
        <p style={{ marginBottom: '0.5rem' }}>
          This tool will re-analyze the emotional content of all your thoughts using the new expanded emotion categories.
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          <strong>Note:</strong> This will use your Gemini API quota and may take several minutes depending on how many thoughts you have.
        </p>
      </div>

      {!isRunning && !isComplete && (
        <button
          className="button-primary"
          onClick={runMigration}
          style={{ width: '100%' }}
        >
          Start Migration
        </button>
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
          <div style={{
            padding: '1.5rem',
            backgroundColor: '#D4EDDA',
            border: '1px solid #4CAF50',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            <h3 style={{ color: '#155724', marginBottom: '1rem' }}>✅ Migration Complete!</h3>
            <div style={{ color: '#155724' }}>
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
