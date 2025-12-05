import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import GoogleSignIn from './components/Auth/GoogleSignIn';
import TabNavigation from './components/Layout/TabNavigation';
import CaptureTab from './components/Capture/CaptureTab';
import ExploreTab from './components/Explore/ExploreTab';
import MyLoomTab from './components/MyLoom/MyLoomTab';
import TagManagerTab from './components/TagManager/TagManagerTab';
import './styles/theme.css';

type TabType = 'capture' | 'explore' | 'myloom' | 'tags';

const ACTIVE_TAB_KEY = 'thoughtloom-active-tab';

const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const savedTab = localStorage.getItem(ACTIVE_TAB_KEY);
    return (savedTab as TabType) || 'capture';
  });

  useEffect(() => {
    localStorage.setItem(ACTIVE_TAB_KEY, activeTab);
  }, [activeTab]);

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
      <header className="app-header">
        <div className="header-logo-wrapper">
          <img src="/thoughtloom_icon.svg" alt="ThoughtLoom Icon" className="header-logo" />
        </div>
        <h1 className="page-title">ThoughtLoom</h1>
        <div className="auth-container-wrapper">
          <GoogleSignIn />
        </div>
      </header>

      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="app-main">
        {activeTab === 'capture' && <CaptureTab />}
        {activeTab === 'explore' && <ExploreTab />}
        {activeTab === 'myloom' && <MyLoomTab />}
        {activeTab === 'tags' && <TagManagerTab />}
      </main>
    </div>
  );
};

export default App;
