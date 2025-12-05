import React from 'react';

export interface DateRange {
  start: Date;
  end: Date;
}

interface DateRangeSelectorProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  dateRange,
  onDateRangeChange,
}) => {
  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const handlePresetClick = (days: number) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    onDateRangeChange({ start, end });
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = new Date(e.target.value);
    newStart.setHours(0, 0, 0, 0);
    onDateRangeChange({ ...dateRange, start: newStart });
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = new Date(e.target.value);
    newEnd.setHours(23, 59, 59, 999);
    onDateRangeChange({ ...dateRange, end: newEnd });
  };

  return (
    <div className="date-range-selector">
      <div className="date-range-presets">
        <button
          className="preset-button"
          onClick={() => handlePresetClick(7)}
        >
          Last 7 days
        </button>
        <button
          className="preset-button"
          onClick={() => handlePresetClick(30)}
        >
          Last 30 days
        </button>
        <button
          className="preset-button"
          onClick={() => handlePresetClick(90)}
        >
          Last 90 days
        </button>
        <button
          className="preset-button"
          onClick={() => handlePresetClick(365)}
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
