import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Timestamp } from 'firebase/firestore';
import { Thought } from '../../types';
import './TimestampEditor.css';

interface TimestampEditorProps {
  thought: Thought;
  isOpen: boolean;
  onClose: () => void;
  onSave: (newTimestamp: Timestamp) => Promise<void>;
}

const TimestampEditor: React.FC<TimestampEditorProps> = ({
  thought,
  isOpen,
  onClose,
  onSave,
}) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize date/time from thought's current timestamp
  useEffect(() => {
    if (isOpen && thought.timestamp) {
      const date = thought.timestamp.toDate();
      // Format date as YYYY-MM-DD for input[type="date"]
      const dateStr = date.toISOString().split('T')[0];
      // Format time as HH:MM for input[type="time"]
      const timeStr = date.toTimeString().slice(0, 5);
      setSelectedDate(dateStr);
      setSelectedTime(timeStr);
      setError(null);
    }
  }, [isOpen, thought.timestamp]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSave = async () => {
    try {
      setError(null);
      setIsSaving(true);

      // Combine date and time into a Date object
      const dateTimeStr = `${selectedDate}T${selectedTime}`;
      const newDate = new Date(dateTimeStr);

      // Validate: prevent future dates
      const now = new Date();
      if (newDate > now) {
        setError('Cannot set a future date');
        setIsSaving(false);
        return;
      }

      // Validate: ensure valid date
      if (isNaN(newDate.getTime())) {
        setError('Invalid date or time');
        setIsSaving(false);
        return;
      }

      // Convert to Firebase Timestamp
      const newTimestamp = Timestamp.fromDate(newDate);

      // Call save handler
      await onSave(newTimestamp);

      // Close modal on success
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update timestamp');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const currentDate = thought.timestamp.toDate();

  const modalContent = (
    <div className="timestamp-editor-backdrop" onClick={handleBackdropClick}>
      <div className="timestamp-editor-modal">
        <h2 className="timestamp-editor-title">Update Thought Timestamp</h2>

        <div className="timestamp-editor-current">
          <strong>Current:</strong> {currentDate.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })}
        </div>

        <div className="timestamp-editor-inputs">
          <div className="timestamp-editor-field">
            <label htmlFor="date-input">Date</label>
            <input
              id="date-input"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="timestamp-editor-field">
            <label htmlFor="time-input">Time</label>
            <input
              id="time-input"
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              disabled={isSaving}
            />
          </div>
        </div>

        {error && <div className="timestamp-editor-error">{error}</div>}

        <div className="timestamp-editor-warning">
          This will change when this thought appears in your timeline
        </div>

        <div className="timestamp-editor-actions">
          <button
            className="timestamp-editor-cancel"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            className="timestamp-editor-save"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default TimestampEditor;
