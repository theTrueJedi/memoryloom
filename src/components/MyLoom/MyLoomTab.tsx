import React, { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useThoughts } from '../../hooks/useThoughts';
import DateRangeSelector, { DateRange } from './DateRangeSelector';
import MoodVisualization from './MoodVisualization';
import TagCloudVisualization from './TagCloudVisualization';

const MyLoomTab: React.FC = () => {
  const { user } = useAuth();
  const { thoughts, loading } = useThoughts(user?.uid);

  // Initialize with last 7 days
  const getDefaultDateRange = (): DateRange => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  };

  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange());

  // Filter thoughts by date range
  const filteredThoughts = useMemo(() => {
    return thoughts.filter((thought) => {
      const thoughtDate = thought.timestamp.toDate();
      return thoughtDate >= dateRange.start && thoughtDate <= dateRange.end;
    });
  }, [thoughts, dateRange]);

  const statsData = useMemo(() => {
    const totalThoughts = filteredThoughts.length;
    const totalTags = new Set(
      filteredThoughts.flatMap((t) => t.tags)
    ).size;

    const avgSentiment = totalThoughts > 0
      ? filteredThoughts.reduce((sum, t) => sum + t.sentiment.score, 0) / totalThoughts
      : 0;

    return {
      totalThoughts,
      totalTags,
      avgSentiment,
    };
  }, [filteredThoughts]);

  const getSentimentLabel = (score: number): string => {
    if (score > 0.3) return 'Positive';
    if (score < -0.3) return 'Negative';
    return 'Neutral';
  };

  const getSentimentColor = (score: number): string => {
    if (score > 0.3) return '#4CAF50';
    if (score < -0.3) return '#F44336';
    return '#9E9E9E';
  };

  return (
    <div className="myloom-tab">
      <div className="myloom-header">
        <h2 className="gradient-text">My Loom</h2>
        <p className="subtitle">Visualize your emotional journey and patterns</p>
      </div>

      <DateRangeSelector
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
        </div>
      ) : (
        <>
          <div className="myloom-stats">
            <div className="stat-card">
              <div className="stat-value">{statsData.totalThoughts}</div>
              <div className="stat-label">Thoughts</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{statsData.totalTags}</div>
              <div className="stat-label">Unique Tags</div>
            </div>
            <div className="stat-card">
              <div
                className="stat-value"
                style={{ color: getSentimentColor(statsData.avgSentiment) }}
              >
                {getSentimentLabel(statsData.avgSentiment)}
              </div>
              <div className="stat-label">
                Avg Sentiment ({statsData.avgSentiment.toFixed(2)})
              </div>
            </div>
          </div>

          <div className="myloom-visualizations">
            <MoodVisualization thoughts={filteredThoughts} />
            <TagCloudVisualization thoughts={filteredThoughts} />
          </div>
        </>
      )}
    </div>
  );
};

export default MyLoomTab;
