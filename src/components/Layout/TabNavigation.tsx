import React from 'react';

interface TabNavigationProps {
  activeTab: 'capture' | 'explore' | 'tags';
  onTabChange: (tab: 'capture' | 'explore' | 'tags') => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav className="tab-navigation">
      <button
        className={`tab-button ${activeTab === 'capture' ? 'active' : ''}`}
        onClick={() => onTabChange('capture')}
      >
        Capture
      </button>
      <button
        className={`tab-button ${activeTab === 'explore' ? 'active' : ''}`}
        onClick={() => onTabChange('explore')}
      >
        Explore
      </button>
      <button
        className={`tab-button ${activeTab === 'tags' ? 'active' : ''}`}
        onClick={() => onTabChange('tags')}
      >
        Tags
      </button>
    </nav>
  );
};

export default TabNavigation;
