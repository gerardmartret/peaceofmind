/**
 * Helper function to format date in local timezone (YYYY-MM-DD)
 * This avoids timezone issues when converting Date objects to strings
 * @param date - The Date object to format
 * @returns Formatted date string in YYYY-MM-DD format
 */
export const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Calculate the number of days between two date strings
 * @param startDate - Start date string (YYYY-MM-DD format)
 * @param endDate - End date string (YYYY-MM-DD format)
 * @returns Number of days between dates, or 30 if dates are invalid
 */
export const calculateDaysFromDates = (startDate: string, endDate: string): number => {
  if (!startDate || !endDate) return 30;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

