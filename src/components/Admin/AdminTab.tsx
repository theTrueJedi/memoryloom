import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import BulkImport from './BulkImport';
import ThoughtReprocessing from './ThoughtReprocessing';
import SentimentConfig from './SentimentConfig';
import SentimentSuggestionReview from './SentimentSuggestionReview';

const AdminTab: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="admin-tab">
        <div className="card">
          <p>Please log in to access admin tools.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-tab">
      <h2 className="gradient-text" style={{ textAlign: 'center', marginBottom: '2rem' }}>
        Admin Tools
      </h2>

      <div className="admin-section">
        <h3 className="admin-section-title">Advanced Editing for Individual Thoughts</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          You can 7-tap an individual past thought on the Explore Tab to manually change datetime, reprocess sentiment, or reprocess tags.
        </p>
      </div>

      <div className="admin-section">
        <h3 className="admin-section-title">Pending Sentiment Changes</h3>
        <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Review and approve sentiment changes from reprocessing.
        </p>
        <SentimentSuggestionReview />
      </div>

      <div className="admin-section">
        <h3 className="admin-section-title">Past Thought Reprocessing</h3>
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            Re-analyze sentiment and generate tag suggestions for your existing thoughts.
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            <strong>Note:</strong> This will use API credits and may take several minutes depending on how many thoughts you have.
          </p>
        </div>
        <ThoughtReprocessing />
      </div>

      <div className="admin-section">
        <BulkImport />
      </div>

      <div className="admin-section">
        <SentimentConfig />
      </div>
    </div>
  );
};

export default AdminTab;
