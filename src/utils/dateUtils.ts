import { format, parseISO, formatISO } from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

/**
 * Formats a UTC date string to a human-readable date format
 * @param dateString - The UTC date string to format
 * @param formatString - The format string to use (default: "MMMM d, yyyy")
 * @param timezone - Optional timezone to display the date in
 * @returns A formatted date string
 */
export const formatDate = (dateString: string, formatString = "MMMM d, yyyy", timezone?: string): string => {
  try {
    // Parse the date string to ensure it's a valid date
    const date = new Date(dateString);
    
    // If timezone is provided, convert from UTC to that timezone
    if (timezone) {
      return formatInTimeZone(date, timezone, formatString);
    }
    
    // Otherwise use local timezone
    return format(date, formatString);
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Invalid date";
  }
};

/**
 * Converts a local date/time to a UTC ISO string for database storage  
 * @param localDateString - The local date string from a date input
 * @param timezone - Optional timezone to interpret the date in (defaults to browser timezone)
 * @returns UTC ISO string for storage
 */
export const toUTCString = (localDateString: string, timezone?: string): string => {
  try {
    if (timezone) {
      // If timezone is specified, convert from that timezone to UTC
      const localDate = new Date(localDateString);
      const utcDate = fromZonedTime(localDate, timezone);
      return utcDate.toISOString();
    }
    
    // For date-only inputs, we want to preserve the date regardless of timezone
    if (localDateString.length === 10) { // YYYY-MM-DD format
      return `${localDateString}T12:00:00.000Z`; // Set to noon UTC to avoid timezone shifts
    }
    
    // For datetime inputs, convert normally
    const localDate = new Date(localDateString);
    return localDate.toISOString();
  } catch (error) {
    console.error("Error converting date to UTC:", error);
    return new Date().toISOString();
  }
};

/**
 * Converts a UTC date string to a local date/time string for input fields
 * @param utcDateString - The UTC date string from the database
 * @param timezone - Optional timezone to convert to (defaults to browser timezone)
 * @param dateOnly - Whether to return date-only format (YYYY-MM-DD)
 * @returns Local date-time string formatted for datetime-local inputs
 */
export const toLocalInputString = (utcDateString: string, timezone?: string, dateOnly = false): string => {
  try {
    // Parse the UTC date
    const date = new Date(utcDateString);
    
    if (timezone) {
      // Convert from UTC to specified timezone
      const zonedDate = toZonedTime(date, timezone);
      return format(zonedDate, dateOnly ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm");
    }
    
    // For dates stored as noon UTC (date-only), just return the date part
    if (utcDateString.includes('T12:00:00')) {
      return format(date, "yyyy-MM-dd");
    }
    
    // Format to local datetime-local input format
    return format(date, dateOnly ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm");
  } catch (error) {
    console.error("Error converting UTC date to local input format:", error);
    return format(new Date(), dateOnly ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm");
  }
};

/**
 * Gets a list of US timezones for utility companies
 */
export const getUSTimezones = () => {
  return [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Phoenix', label: 'Arizona Time (MST)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKST)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' }
  ];
};

/**
 * Gets the user's current timezone
 * @returns The user's timezone (e.g., "America/New_York")
 */
export const getUserTimezone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};