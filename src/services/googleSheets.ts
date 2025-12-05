export interface SheetRow {
  datetime: string;
  thoughtText: string;
  tags: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;

/**
 * Fetches data from a Google Sheet's specific tab
 * @param sheetId - The Google Sheet ID
 * @param tabName - The name of the tab to fetch from (default: 'Import')
 * @returns Array of sheet rows with datetime, thoughtText, and tags
 */
export const fetchSheetData = async (
  sheetId: string,
  tabName: string = 'Import'
): Promise<SheetRow[]> => {
  if (!apiKey || apiKey === 'your_google_sheets_api_key_here') {
    throw new Error('Google Sheets API key not configured');
  }

  try {
    // Fetch from Google Sheets API v4
    // Format: Import!A:C means columns A through C from the Import tab
    const range = `${tabName}!A:C`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Sheet not found. Please ensure the sheet ID is correct and the sheet is publicly viewable.`);
      } else if (response.status === 400) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error?.message?.includes('Unable to parse range')) {
          throw new Error(`Tab "${tabName}" not found in the sheet. Please ensure the tab name is correct.`);
        }
        throw new Error(`Invalid request: ${errorData.error?.message || 'Bad request'}`);
      }
      throw new Error(`Failed to fetch sheet data: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.values || data.values.length === 0) {
      throw new Error('Sheet is empty or has no data');
    }

    // Skip header row (first row) and parse remaining rows
    const rows = data.values.slice(1);

    return rows
      .filter((row: string[]) => {
        // Skip completely empty rows
        return row && row.length > 0 && row.some((cell) => cell && cell.trim());
      })
      .map((row: string[]) => ({
        datetime: row[0] || '',
        thoughtText: row[1] || '',
        tags: row[2] || '',
      }));
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error occurred while fetching sheet data');
  }
};

/**
 * Validates an array of sheet rows for import readiness
 * @param rows - Array of sheet rows to validate
 * @returns Validation result with errors and warnings
 */
export const validateSheetData = (rows: SheetRow[]): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (rows.length === 0) {
    errors.push('No data rows found to import');
    return { valid: false, errors, warnings };
  }

  rows.forEach((row, index) => {
    const rowNum = index + 2; // +2 because we skip header row and are 1-indexed

    // Check for missing required fields
    if (!row.datetime || !row.datetime.trim()) {
      errors.push(`Row ${rowNum}: Missing datetime`);
    } else {
      // Validate datetime format
      const parsedDate = parseDateTime(row.datetime);
      if (!parsedDate || isNaN(parsedDate.getTime())) {
        errors.push(`Row ${rowNum}: Invalid datetime format - "${row.datetime}"`);
      }
    }

    if (!row.thoughtText || !row.thoughtText.trim()) {
      errors.push(`Row ${rowNum}: Missing thought text`);
    }

    // Warnings (non-blocking)
    if (!row.tags || !row.tags.trim()) {
      warnings.push(`Row ${rowNum}: No tags specified (will import without tags)`);
    }

    if (row.thoughtText && row.thoughtText.length > 2000) {
      warnings.push(`Row ${rowNum}: Very long thought text (${row.thoughtText.length} characters)`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Parses a datetime string into a Date object
 * Supports multiple formats: ISO 8601, MM/DD/YYYY HH:MM, YYYY-MM-DD HH:MM, etc.
 * If no time is specified, defaults to 10:00 AM
 * @param dateStr - The datetime string to parse
 * @returns Parsed Date object or null if parsing fails
 */
export const parseDateTime = (dateStr: string): Date | null => {
  if (!dateStr || !dateStr.trim()) {
    return null;
  }

  const trimmed = dateStr.trim();

  // Try native Date parsing first (handles ISO 8601 and many other formats)
  const nativeDate = new Date(trimmed);
  if (!isNaN(nativeDate.getTime())) {
    // If time is midnight (00:00:00), set to 10am instead
    if (nativeDate.getHours() === 0 && nativeDate.getMinutes() === 0 && nativeDate.getSeconds() === 0) {
      // Check if the original string contains time information
      const hasTime = /\d{1,2}:\d{2}/.test(trimmed);
      if (!hasTime) {
        nativeDate.setHours(10, 0, 0, 0);
      }
    }
    return nativeDate;
  }

  // Try MM/DD/YYYY with optional time
  const mdyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/;
  const mdyMatch = trimmed.match(mdyPattern);
  if (mdyMatch) {
    const [, month, day, year, hour = '10', minute = '0', second = '0'] = mdyMatch;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );
  }

  // Try YYYY-MM-DD with optional time
  const ymdPattern = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/;
  const ymdMatch = trimmed.match(ymdPattern);
  if (ymdMatch) {
    const [, year, month, day, hour = '10', minute = '0', second = '0'] = ymdMatch;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );
  }

  return null;
};

/**
 * Parses a comma-separated tags string into an array of tag names
 * Strips whitespace and # symbols from tags
 * @param tagsStr - The tags string to parse
 * @returns Array of cleaned tag names
 */
export const parseTags = (tagsStr: string): string[] => {
  if (!tagsStr || !tagsStr.trim()) {
    return [];
  }

  return tagsStr
    .split(',')
    .map((tag) => tag.trim().replace(/^#/, '')) // Strip leading # if present
    .filter((tag) => tag.length > 0); // Remove empty tags
};
