import React, { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useThoughts } from '../../hooks/useThoughts';
import { useTags } from '../../hooks/useTags';
import { spinYarn } from '../../services/gemini';
import SearchBar from './SearchBar';
import TagList from './TagList';
import ThoughtList from './ThoughtList';
import YarnModal from './YarnModal';

const ExploreTab: React.FC = () => {
  const { user } = useAuth();
  const { thoughts, loading } = useThoughts(user?.uid);
  const { tags } = useTags(user?.uid);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Yarn state
  const [showYarnModal, setShowYarnModal] = useState(false);
  const [yarnContent, setYarnContent] = useState('');
  const [yarnLoading, setYarnLoading] = useState(false);

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

  const handleSpinYarn = async (forceRegenerate = false) => {
    if (!user?.uid || !selectedTag) return;

    setShowYarnModal(true);
    setYarnLoading(true);
    setYarnContent('');

    try {
      const result = await spinYarn(user.uid, selectedTag, forceRegenerate);
      setYarnContent(result.content);
    } catch (error) {
      console.error('Error spinning yarn:', error);
      setYarnContent('Failed to spin yarn. Please try again.');
    } finally {
      setYarnLoading(false);
    }
  };

  const handleCloseYarn = () => {
    setShowYarnModal(false);
    setYarnContent('');
  };

  return (
    <div className="explore-tab">
      <div className="explore-header">
        <h2 className="gradient-text">Explore Your Tapestry</h2>
        <p className="subtitle">Revisit your past thoughts and insights</p>
      </div>

      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      <TagList
        tags={tags}
        selectedTag={selectedTag}
        onTagSelect={setSelectedTag}
      />

      {selectedTag && (
        <button
          className="spin-yarn-button"
          onClick={() => handleSpinYarn(false)}
        >
          Spin a Yarn for #{selectedTag}
        </button>
      )}

      <ThoughtList thoughts={filteredThoughts} loading={loading} />

      {showYarnModal && selectedTag && (
        <YarnModal
          tagName={selectedTag}
          content={yarnContent}
          loading={yarnLoading}
          onClose={handleCloseYarn}
          onRegenerate={() => handleSpinYarn(true)}
        />
      )}
    </div>
  );
};

export default ExploreTab;
