import React from 'react';
import { Thought } from '../../types';
import ThoughtCard from './ThoughtCard';

interface ThoughtListProps {
  thoughts: Thought[];
  loading: boolean;
}

const ThoughtList: React.FC<ThoughtListProps> = ({ thoughts, loading }) => {
  if (loading) {
    return (
      <div className="thought-list-loading">
        <div className="loading-spinner"></div>
        <p>Loading thoughts...</p>
      </div>
    );
  }

  if (thoughts.length === 0) {
    return (
      <div className="empty-state">
        <p>No thoughts found. Start capturing your ideas!</p>
      </div>
    );
  }

  return (
    <div className="thought-list">
      <h3 className="section-title">
        Past Thoughts <span className="thought-count">({thoughts.length})</span>
      </h3>
      <div className="thoughts-grid">
        {thoughts.map((thought) => (
          <ThoughtCard key={thought.id} thought={thought} />
        ))}
      </div>
    </div>
  );
};

export default ThoughtList;
