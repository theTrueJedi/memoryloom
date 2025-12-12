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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Yarn state
  const [showYarnModal, setShowYarnModal] = useState(false);
  const [yarnContent, setYarnContent] = useState('');
  const [yarnLoading, setYarnLoading] = useState(false);

  // Toggle tag selection (add if not selected, remove if already selected)
  const handleTagToggle = (tagName: string | null) => {
    if (tagName === null) {
      // "All Thoughts" clicked - clear all selections
      setSelectedTags([]);
    } else if (selectedTags.includes(tagName)) {
      // Already selected - remove it
      setSelectedTags(selectedTags.filter(t => t !== tagName));
    } else {
      // Not selected - add it
      setSelectedTags([...selectedTags, tagName]);
    }
  };

  // Filter thoughts based on search and tags
  const filteredThoughts = useMemo(() => {
    let filtered = thoughts;

    // Filter by tags (union - show thoughts with ANY selected tag)
    if (selectedTags.length > 0) {
      filtered = filtered.filter((thought) =>
        thought.tags.some(tag => selectedTags.includes(tag))
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
  }, [thoughts, selectedTags, searchQuery]);

  const handleSpinYarn = async (forceRegenerate = false) => {
    // Only allow Spin a Yarn when exactly one tag is selected
    if (!user?.uid || selectedTags.length !== 1) return;
    const selectedTag = selectedTags[0];

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
        selectedTags={selectedTags}
        onTagToggle={handleTagToggle}
        onSpinYarn={() => handleSpinYarn(false)}
      />

      <ThoughtList thoughts={filteredThoughts} loading={loading} />

      {showYarnModal && selectedTags.length === 1 && (
        <YarnModal
          tagName={selectedTags[0]}
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
