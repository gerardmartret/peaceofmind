/**
 * useUserRole Hook
 * 
 * Consolidates all role-related flags into a single, clean role system.
 * Provides permission helpers to replace complex conditional logic.
 */

export type UserRole = 'owner' | 'guest_creator' | 'driver' | 'public_viewer';

export interface UseUserRoleParams {
  isOwner: boolean;
  isGuestCreator: boolean;
  isGuestCreatedTrip: boolean;
  isDriverView: boolean;
  driverToken: string | null;
  ownershipChecked: boolean;
}

export interface UseUserRoleReturn {
  // Primary role
  role: UserRole | null; // null when ownership not yet checked
  
  // Permission helpers
  canEditTrip: boolean;
  canSubmitQuote: boolean;
  canViewQuotes: boolean;
  canUpdateTrip: boolean; // AI update feature
  canAssignDriver: boolean;
  canViewDriverNotes: boolean;
  canEditDriverNotes: boolean;
  canViewFullTripDetails: boolean;
  
  // Legacy flags (for backward compatibility during migration)
  isOwner: boolean;
  isGuestCreator: boolean;
  isGuestCreatedTrip: boolean;
  isDriverView: boolean;
  
  // Ready state
  isReady: boolean; // true when ownershipChecked is true
}

/**
 * Hook to determine user role and permissions
 * 
 * Role priority (first match wins):
 * 1. owner - authenticated user who created the trip
 * 2. guest_creator - unauthenticated user who created the trip (sessionStorage check)
 * 3. driver - user accessing via driver token (magic link)
 * 4. public_viewer - anyone else viewing the trip
 */
export function useUserRole({
  isOwner,
  isGuestCreator,
  isGuestCreatedTrip,
  isDriverView,
  driverToken,
  ownershipChecked,
}: UseUserRoleParams): UseUserRoleReturn {
  
  // Determine role based on priority
  // IMPORTANT: Only determine role when ownershipChecked is true
  // This ensures we don't grant permissions prematurely
  let role: UserRole | null = null;
  
  if (ownershipChecked) {
    // Role determination: check in priority order
    // We need to be certain about each flag before determining role
    if (isOwner) {
      role = 'owner';
    } else if (isGuestCreator) {
      role = 'guest_creator';
    } else if (isDriverView && driverToken) {
      role = 'driver';
    } else {
      // Only set as public_viewer if we're certain they're not owner/guest/driver
      // This prevents race conditions where isOwner might be false temporarily
      role = 'public_viewer';
    }
  }
  
  // Permission helpers
  // CRITICAL: Only grant permissions when we have a determined role
  // This prevents race conditions where ownershipChecked is true but role flags haven't updated yet
  // The role will be null until all state updates have settled
  const hasDeterminedRole = role !== null;
  
  // Use role value directly to avoid race conditions with individual flags
  const canEditTrip = hasDeterminedRole && (role === 'owner' || role === 'guest_creator');
  // Only allow quote submission for drivers and public viewers (not owners or guest creators)
  // Using role directly prevents race conditions where flags haven't updated yet
  const canSubmitQuote = hasDeterminedRole && (role === 'driver' || role === 'public_viewer') && !isGuestCreatedTrip;
  const canViewQuotes = hasDeterminedRole && role === 'owner';
  const canUpdateTrip = hasDeterminedRole && (role === 'owner' || role === 'guest_creator'); // AI update feature
  const canAssignDriver = hasDeterminedRole && role === 'owner';
  const canViewDriverNotes = hasDeterminedRole && (role === 'owner' || (role === 'driver' && !!driverToken));
  const canEditDriverNotes = hasDeterminedRole && role === 'owner';
  const canViewFullTripDetails = ownershipChecked; // Everyone can view, but some features are restricted
  
  return {
    role,
    canEditTrip,
    canSubmitQuote,
    canViewQuotes,
    canUpdateTrip,
    canAssignDriver,
    canViewDriverNotes,
    canEditDriverNotes,
    canViewFullTripDetails,
    // Legacy flags for backward compatibility
    isOwner,
    isGuestCreator,
    isGuestCreatedTrip,
    isDriverView,
    isReady: ownershipChecked,
  };
}

