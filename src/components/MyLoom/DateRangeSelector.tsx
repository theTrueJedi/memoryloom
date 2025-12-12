import React, { useState, useEffect } from 'react';

export interface DateRange {
  start: Date;
  end: Date;
}

type PresetType = 'today' | 'yesterday' | '7days' | '30days' | '90days' | '365days' | null;

const STORAGE_KEY = 'memoryloom-myloom-preset';

interface DateRangeSelectorProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  dateRange,
  onDateRangeChange,
}) => {
  // Load saved preset from localStorage, default to '7days'
  const getSavedPreset = (): PresetType => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && ['today', 'yesterday', '7days', '30days', '90days', '365days'].includes(saved)) {
      return saved as PresetType;
    }
    return '7days';
  };

  const [activePreset, setActivePreset] = useState<PresetType>(getSavedPreset);

  // Save preset to localStorage whenever it changes
  useEffect(() => {
    if (activePreset) {
      localStorage.setItem(STORAGE_KEY, activePreset);
    }
  }, [activePreset]);

  // Apply saved preset on initial mount
  useEffect(() => {
    const savedPreset = getSavedPreset();
    if (savedPreset && savedPreset !== '7days') {
      // Apply the saved preset's date range
      const end = new Date();
      const start = new Date();

      switch (savedPreset) {
        case 'today':
          start.setHours(0, 0, 0, 0);
          break;
        case 'yesterday':
          start.setDate(start.getDate() - 1);
          start.setHours(0, 0, 0, 0);
          end.setHours(4, 0, 0, 0);
          break;
        case '30days':
          end.setHours(23, 59, 59, 999);
          start.setDate(start.getDate() - 30);
          start.setHours(0, 0, 0, 0);
          break;
        case '90days':
          end.setHours(23, 59, 59, 999);
          start.setDate(start.getDate() - 90);
          start.setHours(0, 0, 0, 0);
          break;
        case '365days':
          end.setHours(23, 59, 59, 999);
          start.setDate(start.getDate() - 365);
          start.setHours(0, 0, 0, 0);
          break;
      }

      onDateRangeChange({ start, end });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handlePresetClick = (days: number, preset: PresetType) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    setActivePreset(preset);
    onDateRangeChange({ start, end });
  };

  const handleTodayPreset = () => {
    // From midnight today to current time
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    setActivePreset('today');
    onDateRangeChange({ start, end });
  };

  const handleYesterdayPreset = () => {
    // 28-hour window: from midnight yesterday to 4am today
    const start = new Date();
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(4, 0, 0, 0);
    setActivePreset('yesterday');
    onDateRangeChange({ start, end });
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = new Date(e.target.value);
    newStart.setHours(0, 0, 0, 0);
    setActivePreset(null);
    onDateRangeChange({ ...dateRange, start: newStart });
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = new Date(e.target.value);
    newEnd.setHours(23, 59, 59, 999);
    setActivePreset(null);
    onDateRangeChange({ ...dateRange, end: newEnd });
  };

  return (
    <div className="date-range-selector">
      <div className="date-range-presets">
        <button
          className={`preset-button ${activePreset === 'today' ? 'active' : ''}`}
          onClick={handleTodayPreset}
        >
          Today
        </button>
        <button
          className={`preset-button ${activePreset === 'yesterday' ? 'active' : ''}`}
          onClick={handleYesterdayPreset}
        >
          Yesterday
        </button>
        <button
          className={`preset-button ${activePreset === '7days' ? 'active' : ''}`}
          onClick={() => handlePresetClick(7, '7days')}
        >
          Last 7 days
        </button>
        <button
          className={`preset-button ${activePreset === '30days' ? 'active' : ''}`}
          onClick={() => handlePresetClick(30, '30days')}
        >
          Last 30 days
        </button>
        <button
          className={`preset-button ${activePreset === '90days' ? 'active' : ''}`}
          onClick={() => handlePresetClick(90, '90days')}
        >
          Last 90 days
        </button>
        <button
          className={`preset-button ${activePreset === '365days' ? 'active' : ''}`}
          onClick={() => handlePresetClick(365, '365days')}
        >
          Last year
        </button>
      </div>
      <div className="date-range-inputs">
        <div className="date-input-group">
          <label htmlFor="start-date">From:</label>
          <input
            id="start-date"
            type="date"
            value={formatDateForInput(dateRange.start)}
            onChange={handleStartDateChange}
            max={formatDateForInput(dateRange.end)}
          />
        </div>
        <div className="date-input-group">
          <label htmlFor="end-date">To:</label>
          <input
            id="end-date"
            type="date"
            value={formatDateForInput(dateRange.end)}
            onChange={handleEndDateChange}
            min={formatDateForInput(dateRange.start)}
            max={formatDateForInput(new Date())}
          />
        </div>
      </div>
    </div>
  );
};

export default DateRangeSelector;
