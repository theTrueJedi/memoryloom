import React, { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useThoughts } from '../../hooks/useThoughts';
import { useTags } from '../../hooks/useTags';
import SearchBar from './SearchBar';
import TagList from './TagList';
import ThoughtList from './ThoughtList';

const ExploreTab: React.FC = () => {
  const { user } = useAuth();
  const { thoughts, loading } = useThoughts(user?.uid);
  const { tags } = useTags(user?.uid);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Filter thoughts based on search and tag
  const filteredThoughts = useMemo(() => {
    let filtered = thoughts;

    // Filter by tag
    if (selectedTag) {
      filtered = filtered.filter((thought) =>
        thought.tags.includes(selectedTag)
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((thought) =>
        thought.content.toLowerCase().includes(query) ||
        thought.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [thoughts, selectedTag, searchQuery]);

  return (
    <div className="explore-tab">
      <div className="explore-header">
        <h2 className="gradient-text">Explore Your Thoughts</h2>
        <p className="subtitle">Discover patterns and insights in your journal</p>
      </div>

      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      <TagList
        tags={tags}
        selectedTag={selectedTag}
        onTagSelect={setSelectedTag}
      />

      <ThoughtList thoughts={filteredThoughts} loading={loading} />
    </div>
  );
};

export default ExploreTab;
