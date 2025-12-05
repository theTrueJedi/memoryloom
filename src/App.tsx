import React, { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import GoogleSignIn from './components/Auth/GoogleSignIn';
import TabNavigation from './components/Layout/TabNavigation';
import CaptureTab from './components/Capture/CaptureTab';
import ExploreTab from './components/Explore/ExploreTab';
import TagManagerTab from './components/TagManager/TagManagerTab';
import './styles/theme.css';

type TabType = 'capture' | 'explore' | 'tags';

const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('capture');

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
        {activeTab === 'tags' && <TagManagerTab />}
      </main>
    </div>
  );
};

export default App;
