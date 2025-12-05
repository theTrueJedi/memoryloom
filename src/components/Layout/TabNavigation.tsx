import React from 'react';

interface TabNavigationProps {
  activeTab: 'capture' | 'explore' | 'myloom' | 'tags' | 'admin';
  onTabChange: (tab: 'capture' | 'explore' | 'myloom' | 'tags' | 'admin') => void;
  showAdminTab?: boolean;
  onMenuBarClick?: () => void;
}

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange, showAdminTab = false, onMenuBarClick }) => {
  return (
    <nav className="tab-navigation" onClick={onMenuBarClick} style={{ cursor: onMenuBarClick ? 'pointer' : 'default' }}>
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
        className={`tab-button ${activeTab === 'myloom' ? 'active' : ''}`}
        onClick={() => onTabChange('myloom')}
      >
        My Loom
      </button>
      <button
        className={`tab-button ${activeTab === 'tags' ? 'active' : ''}`}
        onClick={() => onTabChange('tags')}
      >
        Tags
      </button>
      {showAdminTab && (
        <button
          className={`tab-button ${activeTab === 'admin' ? 'active' : ''}`}
          onClick={() => onTabChange('admin')}
        >
          Admin
        </button>
      )}
    </nav>
  );
};

export default TabNavigation;
