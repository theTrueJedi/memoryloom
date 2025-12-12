import { useState, useRef, useEffect } from 'react';
import { YarnSettings } from '../../types';
import { getYarnForTag } from '../../services/firestore';
import BarSelect from '../common/BarSelect';

const STYLE_OPTIONS = [
  { value: 'yourVoice', label: 'Your Voice' },
  { value: 'greekMyth', label: 'Greek Myth' },
  { value: 'medieval', label: 'Medieval' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'pulp', label: 'Pulp' },
  { value: 'western', label: 'Western' },
  { value: 'lovecraftian', label: 'Lovecraftian' },
  { value: 'custom', label: 'Write your own' },
] as const;

const PERSPECTIVE_OPTIONS = [
  { value: 'first' as const, label: 'First' },
  { value: 'second' as const, label: 'Second' },
  { value: 'third' as const, label: 'Third' },
];

const DELIVERY_OPTIONS = [
  { value: 'curt' as const, label: 'Curt' },
  { value: 'normal' as const, label: 'Normal' },
  { value: 'unabridged' as const, label: 'Unabridged' },
];

const COVERAGE_OPTIONS = [
  { value: 'recent' as const, label: 'Recent' },
  { value: 'month' as const, label: 'Month' },
  { value: 'allTime' as const, label: 'All Time' },
];

// Default settings for comparison
const DEFAULT_SETTINGS = {
  perspective: 'second',
  delivery: 'normal',
  coverage: 'allTime',
  style: 'yourVoice',
  customPrompt: '',
};

interface SpinYarnSectionProps {
  selectedTags: string[];
  onSpinYarn: (settings: YarnSettings) => void;
  userId?: string;
}

const SpinYarnSection: React.FC<SpinYarnSectionProps> = ({
  selectedTags,
  onSpinYarn,
  userId,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [perspective, setPerspective] = useState<'first' | 'second' | 'third'>('second');
  const [delivery, setDelivery] = useState<'curt' | 'normal' | 'unabridged'>('normal');
  const [coverage, setCoverage] = useState<'recent' | 'month' | 'allTime'>('allTime');
  const [style, setStyle] = useState<string>('yourVoice');
  const [customPrompt, setCustomPrompt] = useState('');

  // Track if a cached yarn exists for the selected tag
  const [cachedYarnExists, setCachedYarnExists] = useState(false);
  const [cachedYarnDate, setCachedYarnDate] = useState<Date | undefined>();
  const [savedSettings, setSavedSettings] = useState<YarnSettings | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check for existing yarn when tag selection changes and restore settings
  useEffect(() => {
    const checkForExistingYarn = async () => {
      if (!userId || selectedTags.length !== 1) {
        setCachedYarnExists(false);
        setCachedYarnDate(undefined);
        setSavedSettings(null);
        // Reset to defaults when no tag selected
        setPerspective('second');
        setDelivery('normal');
        setCoverage('allTime');
        setStyle('yourVoice');
        setCustomPrompt('');
        return;
      }

      const result = await getYarnForTag(userId, selectedTags[0]);
      setCachedYarnExists(result.exists);
      setCachedYarnDate(result.createdAt);

      // Restore saved settings if they exist, otherwise use defaults
      if (result.settings) {
        setSavedSettings(result.settings);
        setPerspective(result.settings.perspective || 'second');
        setDelivery(result.settings.delivery || 'normal');
        setCoverage(result.settings.coverage || 'allTime');
        setStyle(result.settings.style || 'yourVoice');
        setCustomPrompt(result.settings.customPrompt || '');
      } else {
        // No saved settings - use defaults
        setSavedSettings(null);
        setPerspective('second');
        setDelivery('normal');
        setCoverage('allTime');
        setStyle('yourVoice');
        setCustomPrompt('');
      }
    };

    checkForExistingYarn();
  }, [userId, selectedTags]);

  // Auto-expand textarea as user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [customPrompt]);

  // Check if settings have been modified from saved/default settings
  const hasCustomSettings = (() => {
    // Compare against saved settings if they exist, otherwise compare against defaults
    const compareSettings = savedSettings || DEFAULT_SETTINGS;
    return (
      perspective !== compareSettings.perspective ||
      delivery !== compareSettings.delivery ||
      coverage !== compareSettings.coverage ||
      style !== compareSettings.style ||
      customPrompt.trim() !== (compareSettings.customPrompt || '')
    );
  })();

  const handleSpinYarn = () => {
    const settings: YarnSettings = {
      perspective,
      delivery,
      coverage,
      style,
      customPrompt,
    };
    onSpinYarn(settings);
  };

  const isDisabled = selectedTags.length !== 1;
  const selectedTag = selectedTags.length === 1 ? selectedTags[0] : '____';

  // Determine button text
  const getButtonText = () => {
    if (isDisabled) {
      return 'Spin your Yarn for #____';
    }
    if (cachedYarnExists && !hasCustomSettings) {
      return `View last Yarn for #${selectedTag}`;
    }
    return `Spin your Yarn for #${selectedTag}`;
  };

  // Format relative time for the cached yarn
  const getRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
  };

  return (
    <div className={`spin-yarn-section ${expanded ? '' : 'collapsed'}`}>
      <button
        className="spin-yarn-header"
        onClick={() => setExpanded(!expanded)}
        type="button"
      >
        <span className={`collapse-arrow ${expanded ? 'expanded' : ''}`}>▶</span>
        <h3>Spin a Yarn</h3>
      </button>

      <div className="spin-yarn-settings">
        <p className="spin-yarn-instructions">
          Select one or more Tags above, and how you'd like your story told...
        </p>

        <h4 className="settings-subheader">Storytelling Patterns</h4>

        <div className="setting-row">
          <label>Personal Perspective</label>
          <BarSelect
            options={PERSPECTIVE_OPTIONS}
            value={perspective}
            onChange={setPerspective}
          />
        </div>

        <div className="setting-row">
          <label>Delivery</label>
          <BarSelect
            options={DELIVERY_OPTIONS}
            value={delivery}
            onChange={setDelivery}
          />
        </div>

        <div className="setting-row">
          <label>Coverage</label>
          <BarSelect
            options={COVERAGE_OPTIONS}
            value={coverage}
            onChange={setCoverage}
          />
        </div>

        <div className="setting-row">
          <label>Style</label>
          <div className="style-chips">
            {STYLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`style-chip ${style === option.value ? 'active' : ''}`}
                onClick={() => setStyle(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="setting-row">
          <label>Other Inputs:</label>
          <textarea
            ref={textareaRef}
            className="custom-prompt-input"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Add any additional instructions for your story..."
            rows={1}
          />
        </div>

        {/* Helper message for existing yarn */}
        {cachedYarnExists && !isDisabled && (
          <p className="yarn-cache-hint">
            {hasCustomSettings ? (
              <>Changing settings will generate a new Yarn (last spun {cachedYarnDate ? getRelativeTime(cachedYarnDate) : 'previously'})</>
            ) : (
              <>A Yarn was spun for #{selectedTag} {cachedYarnDate ? getRelativeTime(cachedYarnDate) : 'previously'}</>
            )}
          </p>
        )}

        <button
          className={`spin-yarn-button ${isDisabled ? 'disabled' : ''}`}
          onClick={handleSpinYarn}
          disabled={isDisabled}
          type="button"
        >
          {getButtonText()}
        </button>
      </div>
    </div>
  );
};

export default SpinYarnSection;
