import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import GoogleSignIn from './components/Auth/GoogleSignIn';
import TabNavigation from './components/Layout/TabNavigation';
import CaptureTab from './components/Capture/CaptureTab';
import ExploreTab from './components/Explore/ExploreTab';
import MyLoomTab from './components/MyLoom/MyLoomTab';
import TagManagerTab from './components/TagManager/TagManagerTab';
import AdminTab from './components/Admin/AdminTab';
import './styles/theme.css';

type TabType = 'collect' | 'explore' | 'myloom' | 'tags' | 'admin';

const ACTIVE_TAB_KEY = 'memoryloom-active-tab';

const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    // Use sessionStorage so tab persists on refresh but resets on new visit
    const savedTab = sessionStorage.getItem(ACTIVE_TAB_KEY);
    return (savedTab as TabType) || 'collect';
  });
  const [showAdminTab, setShowAdminTab] = useState(false);
  const [headerTapCount, setHeaderTapCount] = useState(0);

  useEffect(() => {
    sessionStorage.setItem(ACTIVE_TAB_KEY, activeTab);
  }, [activeTab]);

  // If admin tab is hidden and user is on it, switch to collect
  useEffect(() => {
    if (!showAdminTab && activeTab === 'admin') {
      setActiveTab('collect');
    }
  }, [showAdminTab, activeTab]);

  // Scroll to top when tapping title bar
  const handleTitleBarClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle secret admin tab activation
  const handleHeaderClick = () => {
    const newCount = headerTapCount + 1;
    setHeaderTapCount(newCount);

    if (newCount === 7) {
      setShowAdminTab(true);
      setHeaderTapCount(0); // Reset counter
    }

    // Reset counter after 2 seconds of no taps
    setTimeout(() => {
      setHeaderTapCount(0);
    }, 2000);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <GoogleSignIn />;
  }

  return (
    <div className="app">
      <div className="app-sticky-header">
        <header className="app-header">
          <div className="header-title-area" onClick={handleTitleBarClick} style={{ cursor: 'pointer' }}>
            <div className="header-logo-wrapper">
              <img src="/memoryloom_icon.svg" alt="MemoryLoom Icon" className="header-logo" />
            </div>
            <h1 className="page-title">MemoryLoom</h1>
          </div>
          <div className="auth-container-wrapper">
            <GoogleSignIn />
          </div>
        </header>

        <TabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          showAdminTab={showAdminTab}
          onMenuBarClick={handleHeaderClick}
        />
      </div>

      <main className="app-main">
        {activeTab === 'collect' && <CaptureTab />}
        {activeTab === 'explore' && <ExploreTab />}
        {activeTab === 'myloom' && <MyLoomTab />}
        {activeTab === 'tags' && <TagManagerTab />}
        {activeTab === 'admin' && <AdminTab />}
      </main>
    </div>
  );
};

export default App;
