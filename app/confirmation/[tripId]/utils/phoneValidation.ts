/**
 * Validates phone number format for Drivania API
 * @param phone - Phone number string to validate
 * @returns Error message string if invalid, null if valid
 */
export function validatePhoneNumber(phone: string): string | null {
  if (!phone || phone.trim() === '') {
    return 'Phone number is required';
  }
  
  // Remove all non-numeric characters except leading +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // Check if it's a valid phone number format (at least 7 digits, optionally with country code)
  // Allow formats like: +1234567890, 1234567890, etc.
  const digitsOnly = cleaned.replace(/\+/g, '');
  
  if (digitsOnly.length < 7) {
    return 'Please enter a valid phone number with country code (e.g., +1234567890)';
  }
  
  // Check if it has too many digits (unlikely to be valid)
  if (digitsOnly.length > 15) {
    return 'Phone number is too long. Please enter a valid phone number (max 15 digits)';
  }
  
  return null;
}
