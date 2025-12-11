import React, { useState } from 'react';

export interface DateRange {
  start: Date;
  end: Date;
}

type PresetType = 'today' | 'yesterday' | '7days' | '30days' | '90days' | '365days' | null;

interface DateRangeSelectorProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  dateRange,
  onDateRangeChange,
}) => {
  const [activePreset, setActivePreset] = useState<PresetType>('7days');

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

  const handleSingleDayPreset = (daysAgo: number, preset: PresetType) => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    setActivePreset(preset);
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
          onClick={() => handleSingleDayPreset(0, 'today')}
        >
          Today
        </button>
        <button
          className={`preset-button ${activePreset === 'yesterday' ? 'active' : ''}`}
          onClick={() => handleSingleDayPreset(1, 'yesterday')}
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
