import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import BulkImport from './BulkImport';
import SentimentMigration from './SentimentMigration';
import SentimentConfig from './SentimentConfig';

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
        <h3 className="admin-section-title">Sentiment Migration Tool</h3>
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            This tool will re-analyze the emotional content of all your thoughts using the expanded emotion categories.
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            <strong>Note:</strong> This will use your Gemini API quota and may take several minutes depending on how many thoughts you have.
          </p>
        </div>
        <SentimentMigration />
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
