/**
 * Helper function to convert numbers to letters (1 -> A, 2 -> B, etc.)
 * @param num - The number to convert (1-based)
 * @returns The corresponding letter (A, B, C, etc.)
 */
export const numberToLetter = (num: number): string => {
  return String.fromCharCode(64 + num); // 65 is 'A' in ASCII
};

