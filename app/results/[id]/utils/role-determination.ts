/**
 * Role Determination Utility
 * 
 * Determines user role based on trip ownership and authentication status.
 * Pure function with no side effects.
 */

export interface RoleInfo {
  isOwner: boolean;
  isGuestCreator: boolean;
  isGuestCreatedTrip: boolean;
}

/**
 * Determines user role for a trip
 * 
 * @param tripUserId - The user_id from the trip record (null if guest-created)
 * @param currentUserId - The current authenticated user's ID
 * @param isAuthenticated - Whether user is authenticated
 * @param tripId - The trip ID (for guest creator check)
 * @returns Role information object
 */
export function determineRole(
  tripUserId: string | null,
  currentUserId: string | null,
  isAuthenticated: boolean,
  tripId: string
): RoleInfo {
  // Check ownership: if user is authenticated and their ID matches the trip's user_id
  const isOwner = isAuthenticated && currentUserId !== null && tripUserId === currentUserId;

  // Check if trip was created by a guest (user_id is null)
  const isGuestCreatedTrip = tripUserId === null;

  // Check if user is guest creator (for signup CTA)
  let isGuestCreator = false;
  if (!isAuthenticated && !tripUserId && typeof window !== 'undefined') {
    const createdTripId = sessionStorage.getItem('guestCreatedTripId');
    if (createdTripId === tripId) {
      isGuestCreator = true;
    }
  }

  return {
    isOwner,
    isGuestCreator,
    isGuestCreatedTrip,
  };
}

