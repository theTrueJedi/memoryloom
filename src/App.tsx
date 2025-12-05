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

type TabType = 'capture' | 'explore' | 'myloom' | 'tags' | 'admin';

const ACTIVE_TAB_KEY = 'thoughtloom-active-tab';

const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const savedTab = localStorage.getItem(ACTIVE_TAB_KEY);
    return (savedTab as TabType) || 'capture';
  });
  const [showAdminTab, setShowAdminTab] = useState(false);
  const [headerTapCount, setHeaderTapCount] = useState(0);

  useEffect(() => {
    localStorage.setItem(ACTIVE_TAB_KEY, activeTab);
  }, [activeTab]);

  // If admin tab is hidden and user is on it, switch to capture
  useEffect(() => {
    if (!showAdminTab && activeTab === 'admin') {
      setActiveTab('capture');
    }
  }, [showAdminTab, activeTab]);

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
          <div className="header-logo-wrapper">
            <img src="/thoughtloom_icon.svg" alt="ThoughtLoom Icon" className="header-logo" />
          </div>
          <h1 className="page-title">ThoughtLoom</h1>
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
        {activeTab === 'capture' && <CaptureTab />}
        {activeTab === 'explore' && <ExploreTab />}
        {activeTab === 'myloom' && <MyLoomTab />}
        {activeTab === 'tags' && <TagManagerTab />}
        {activeTab === 'admin' && <AdminTab />}
      </main>
    </div>
  );
};

export default App;
