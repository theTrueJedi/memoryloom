import React, { useState, useEffect } from 'react';
import { EmotionLabel } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { getSentimentColor, getSentimentEmoji, getAllEmotionLabels } from '../../utils/sentimentUtils';

interface SentimentConfigItem {
  label: EmotionLabel;
  emoji: string;
  color: string;
}

interface ConfigDiff {
  label: EmotionLabel;
  current: { emoji: string; color: string };
  default: { emoji: string; color: string };
}

// Get latest defaults from sentimentUtils
const getLatestDefaults = (): Record<EmotionLabel, { emoji: string; color: string }> => {
  const labels = getAllEmotionLabels();
  return labels.reduce((acc, label) => {
    acc[label] = {
      emoji: getSentimentEmoji(label),
      color: getSentimentColor(label),
    };
    return acc;
  }, {} as Record<EmotionLabel, { emoji: string; color: string }>);
};

const SentimentConfig: React.FC = () => {
  const { user } = useAuth();
  const [config, setConfig] = useState<SentimentConfigItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDefaultsPreview, setShowDefaultsPreview] = useState(false);
  const [configDiffs, setConfigDiffs] = useState<ConfigDiff[]>([]);

  // Load user's sentiment config from Firestore on mount
  useEffect(() => {
    const loadConfig = async () => {
      if (!user?.uid) return;

      const defaults = getLatestDefaults();

      try {
        const configRef = doc(db, `users/${user.uid}/config`, 'sentimentConfig');
        const configSnap = await getDoc(configRef);

        if (configSnap.exists()) {
          const savedConfig = configSnap.data().config as Record<EmotionLabel, { emoji: string; color: string }>;

          // Merge saved config with defaults to include any new emotions
          const mergedConfig = { ...defaults, ...savedConfig };

          // Convert to array format for rendering
          const configArray: SentimentConfigItem[] = Object.entries(mergedConfig).map(([label, data]) => ({
            label: label as EmotionLabel,
            emoji: data.emoji,
            color: data.color,
          }));

          setConfig(configArray);
        } else {
          // Use defaults if no saved config
          const defaultArray: SentimentConfigItem[] = Object.entries(defaults).map(([label, data]) => ({
            label: label as EmotionLabel,
            emoji: data.emoji,
            color: data.color,
          }));
          setConfig(defaultArray);
        }
      } catch (error) {
        console.error('Error loading sentiment config:', error);
        // Fall back to defaults on error
        const defaultArray: SentimentConfigItem[] = Object.entries(defaults).map(([label, data]) => ({
          label: label as EmotionLabel,
          emoji: data.emoji,
          color: data.color,
        }));
        setConfig(defaultArray);
      }
    };

    loadConfig();
  }, [user?.uid]);

  // Calculate differences between current config and defaults
  const calculateDiffs = () => {
    const defaults = getLatestDefaults();
    const diffs: ConfigDiff[] = [];

    config.forEach(item => {
      const defaultItem = defaults[item.label];
      if (defaultItem && (item.emoji !== defaultItem.emoji || item.color.toLowerCase() !== defaultItem.color.toLowerCase())) {
        diffs.push({
          label: item.label,
          current: { emoji: item.emoji, color: item.color },
          default: defaultItem,
        });
      }
    });

    return diffs;
  };

  const handleShowDefaultsPreview = () => {
    const diffs = calculateDiffs();
    setConfigDiffs(diffs);
    setShowDefaultsPreview(true);
  };

  const handleApplyDefaults = () => {
    const defaults = getLatestDefaults();
    const defaultArray: SentimentConfigItem[] = Object.entries(defaults).map(([label, data]) => ({
      label: label as EmotionLabel,
      emoji: data.emoji,
      color: data.color,
    }));
    setConfig(defaultArray);
    setShowDefaultsPreview(false);
    setSaveMessage({ type: 'success', text: 'Defaults applied. Remember to save!' });
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleEmojiChange = (label: EmotionLabel, newEmoji: string) => {
    setConfig(prev =>
      prev.map(item =>
        item.label === label ? { ...item, emoji: newEmoji } : item
      )
    );
  };

  const handleColorChange = (label: EmotionLabel, newColor: string) => {
    setConfig(prev =>
      prev.map(item =>
        item.label === label ? { ...item, color: newColor } : item
      )
    );
  };

  const handleSave = async () => {
    if (!user?.uid) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      // Convert array back to object format for storage
      const configObject = config.reduce((acc, item) => {
        acc[item.label] = { emoji: item.emoji, color: item.color };
        return acc;
      }, {} as Record<EmotionLabel, { emoji: string; color: string }>);

      const configRef = doc(db, `users/${user.uid}/config`, 'sentimentConfig');
      await setDoc(configRef, {
        config: configObject,
        updatedAt: new Date().toISOString(),
      });

      setSaveMessage({ type: 'success', text: 'Configuration saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving sentiment config:', error);
      setSaveMessage({ type: 'error', text: 'Failed to save configuration. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    // Convert config to a format that can be pasted into code
    const configObject = config.reduce((acc, item) => {
      acc[item.label] = { emoji: item.emoji, color: item.color };
      return acc;
    }, {} as Record<EmotionLabel, { emoji: string; color: string }>);

    const exportData = {
      config: configObject,
      exportedAt: new Date().toISOString(),
      exportedBy: user?.email || 'unknown',
    };

    // Format as TypeScript code for easy copy-paste
    const codeFormat = `// Sentiment Configuration
// Exported: ${exportData.exportedAt}
// By: ${exportData.exportedBy}

const SENTIMENT_CONFIG: Record<EmotionLabel, { emoji: string; color: string }> = ${JSON.stringify(configObject, null, 2)};`;

    // Copy to clipboard
    navigator.clipboard.writeText(codeFormat).then(() => {
      setSaveMessage({ type: 'success', text: 'Configuration copied to clipboard!' });
      setTimeout(() => setSaveMessage(null), 3000);
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
      setSaveMessage({ type: 'error', text: 'Failed to copy to clipboard' });
    });
  };

  if (!user) {
    return <p>Please log in to configure sentiments.</p>;
  }

  return (
    <div className="sentiment-config">
      <h3 className="admin-section-title">Sentiment Configuration</h3>
      <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        Customize the emoji and color for each sentiment. Changes will be saved to your profile.
      </p>

      <button
        onClick={handleShowDefaultsPreview}
        style={{
          marginBottom: '1rem',
          padding: '0.5rem 1rem',
          backgroundColor: 'var(--bg-input)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-medium)',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '0.875rem',
        }}
      >
        Pull Latest Defaults
      </button>

      {showDefaultsPreview && (
        <div style={{
          marginBottom: '1rem',
          padding: '1rem',
          backgroundColor: 'var(--bg-input)',
          border: '1px solid var(--border-medium)',
          borderRadius: '8px',
        }}>
          <h4 style={{ marginBottom: '0.75rem', fontSize: '0.875rem' }}>
            {configDiffs.length === 0 ? 'No differences found' : `${configDiffs.length} setting(s) will be overwritten:`}
          </h4>
          {configDiffs.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              {configDiffs.map(diff => (
                <div key={diff.label} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.5rem',
                  marginBottom: '0.5rem',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}>
                  <strong style={{ minWidth: '100px' }}>
                    {diff.label.charAt(0).toUpperCase() + diff.label.slice(1)}
                  </strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: diff.current.color,
                        fontSize: '14px',
                      }}
                    >
                      {diff.current.emoji}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{diff.current.color}</span>
                  </div>
                  <span style={{ color: 'var(--text-secondary)' }}>→</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: diff.default.color,
                        fontSize: '14px',
                      }}
                    >
                      {diff.default.emoji}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{diff.default.color}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {configDiffs.length > 0 && (
              <button
                onClick={handleApplyDefaults}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'var(--primary-teal)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Apply Defaults
              </button>
            )}
            <button
              onClick={() => setShowDefaultsPreview(false)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-medium)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="sentiment-config-list">
        {config.map((item) => (
          <div key={item.label} className="sentiment-config-row">
            <div className="sentiment-preview">
              <span
                className="sentiment-circle"
                style={{
                  backgroundColor: item.color,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  fontSize: '18px',
                  textShadow: '0.5px 0.87px 2px rgba(0, 0, 0, 0.35), 1px 1.73px 4px rgba(0, 0, 0, 0.25)',
                }}
              >
                {item.emoji}
              </span>
            </div>

            <div className="sentiment-name">
              <strong>{item.label.charAt(0).toUpperCase() + item.label.slice(1)}</strong>
            </div>

            <div className="sentiment-emoji-picker">
              <label htmlFor={`emoji-${item.label}`} style={{ fontSize: '0.75rem', marginRight: '0.5rem' }}>
                Emoji:
              </label>
              <input
                id={`emoji-${item.label}`}
                type="text"
                value={item.emoji}
                onChange={(e) => handleEmojiChange(item.label, e.target.value)}
                maxLength={2}
                style={{
                  width: '60px',
                  textAlign: 'center',
                  fontSize: '18px',
                  padding: '0.25rem',
                }}
              />
            </div>

            <div className="sentiment-color-picker">
              <label htmlFor={`color-${item.label}`} style={{ fontSize: '0.75rem', marginRight: '0.5rem' }}>
                Color:
              </label>
              <input
                id={`color-${item.label}`}
                type="color"
                value={item.color}
                onChange={(e) => handleColorChange(item.label, e.target.value)}
                style={{
                  width: '50px',
                  height: '30px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              />
              <input
                type="text"
                value={item.color}
                onChange={(e) => handleColorChange(item.label, e.target.value)}
                placeholder="#000000"
                maxLength={7}
                style={{
                  width: '80px',
                  marginLeft: '0.5rem',
                  padding: '0.25rem',
                  fontSize: '0.75rem',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {saveMessage && (
        <div
          className={`save-message ${saveMessage.type}`}
          style={{
            padding: '0.75rem',
            marginTop: '1rem',
            borderRadius: '4px',
            backgroundColor: saveMessage.type === 'success' ? '#4CAF50' : '#F44336',
            color: 'white',
            textAlign: 'center',
          }}
        >
          {saveMessage.text}
        </div>
      )}

      <div className="sentiment-config-actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="primary-button"
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: 'var(--primary-color)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isSaving ? 'not-allowed' : 'pointer',
            opacity: isSaving ? 0.6 : 1,
          }}
        >
          {isSaving ? 'Saving...' : 'Save Configuration'}
        </button>

        <button
          onClick={handleExport}
          className="secondary-button"
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: 'var(--secondary-color)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Export for Codebase
        </button>
      </div>
    </div>
  );
};

export default SentimentConfig;
