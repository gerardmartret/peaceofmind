// State transition validation
export const isValidTransition = (from: string, to: string): boolean => {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    'not confirmed': ['pending', 'confirmed'],
    'pending': ['confirmed', 'rejected', 'cancelled'], // Can cancel to cancelled
    'confirmed': ['cancelled'], // Can cancel to cancelled
    'rejected': ['pending', 'not confirmed'], // Can retry after rejection
    'cancelled': [], // TERMINAL STATUS - no transitions allowed, must create new trip
  };

  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
};

