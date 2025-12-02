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

