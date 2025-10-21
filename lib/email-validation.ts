/**
 * Email validation utility for business email addresses only
 * Blocks free email providers and spam/test addresses
 */

// List of common free email providers to block
const FREE_EMAIL_PROVIDERS = [
  // Google
  'gmail.com', 'googlemail.com',
  
  // Microsoft
  'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'hotmail.co.uk', 
  'outlook.co.uk', 'live.co.uk',
  
  // Yahoo
  'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'yahoo.fr', 'yahoo.de',
  
  // Apple
  'icloud.com', 'me.com', 'mac.com',
  
  // AOL
  'aol.com', 'aim.com',
  
  // ProtonMail
  'protonmail.com', 'proton.me', 'pm.me',
  
  // Other popular free providers
  'mail.com', 'gmx.com', 'gmx.net', 'zoho.com', 'yandex.com', 'yandex.ru',
  'mail.ru', 'inbox.com', 'fastmail.com', 'tutanota.com', 'tutamail.com',
  'hey.com', 'hushmail.com',
  
  // Temporary/disposable email providers
  'tempmail.com', 'guerrillamail.com', 'mailinator.com', '10minutemail.com',
  'throwaway.email', 'maildrop.cc', 'sharklasers.com', 'guerrillamail.info',
  'grr.la', 'guerrillamail.biz', 'guerrillamail.de', 'spam4.me', 'trashmail.com',
];

// Patterns that indicate test/spam emails
const SPAM_PATTERNS = [
  /^test@/i,
  /^test\d*@/i,
  /^demo@/i,
  /^spam@/i,
  /^fake@/i,
  /^example@/i,
  /^sample@/i,
  /^noreply@/i,
  /^no-reply@/i,
  /^dummy@/i,
  /^temp@/i,
  /^throwaway@/i,
  /^trash@/i,
  /^junk@/i,
  /^abuse@/i,
  /@test\./i,
  /@example\./i,
  /@sample\./i,
  /@demo\./i,
  /^admin@/i,
  /^info@/i,
  /^hello@/i,
  /^contact@/i,
  /\+test@/i,
  /\+spam@/i,
];

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates if an email is a business email address
 * @param email - The email address to validate
 * @returns Validation result with error message if invalid
 */
export function validateBusinessEmail(email: string): EmailValidationResult {
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!email || !email.trim()) {
    return {
      isValid: false,
      error: 'Email address is required',
    };
  }

  const trimmedEmail = email.trim().toLowerCase();

  if (!emailRegex.test(trimmedEmail)) {
    return {
      isValid: false,
      error: 'Please enter a valid email address',
    };
  }

  // Extract domain from email
  const domain = trimmedEmail.split('@')[1];

  // Check against free email providers
  if (FREE_EMAIL_PROVIDERS.includes(domain)) {
    return {
      isValid: false,
      error: 'Please use a business email address. Personal email providers (Gmail, Yahoo, etc.) are not accepted.',
    };
  }

  // Check against spam/test patterns
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(trimmedEmail)) {
      return {
        isValid: false,
        error: 'This email address appears to be a test or temporary address. Please use a valid business email.',
      };
    }
  }

  // Check for valid domain structure (must have at least one dot)
  if (!domain.includes('.')) {
    return {
      isValid: false,
      error: 'Please enter a valid email domain',
    };
  }

  // Check domain length (basic sanity check)
  const domainParts = domain.split('.');
  const tld = domainParts[domainParts.length - 1];
  
  if (tld.length < 2 || tld.length > 10) {
    return {
      isValid: false,
      error: 'Please enter a valid email domain',
    };
  }

  // All checks passed
  return {
    isValid: true,
  };
}

/**
 * Gets a user-friendly error message for display
 * @param validationResult - The validation result
 * @returns Error message or null if valid
 */
export function getEmailErrorMessage(validationResult: EmailValidationResult): string | null {
  if (validationResult.isValid) {
    return null;
  }
  return validationResult.error || 'Invalid email address';
}

