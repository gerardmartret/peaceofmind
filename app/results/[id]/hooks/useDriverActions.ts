/**
 * useDriverActions Hook
 * 
 * Handles driver actions for trip confirmation/rejection:
 * - Driver confirming a pending trip
 * - Driver rejecting a pending trip
 * - Related state management and validation
 */

import { useState, useCallback } from 'react';

export interface UseDriverActionsParams {
  tripId: string | undefined;
  driverToken: string | null;
  isAuthenticated: boolean;
  canTakeAction: boolean;
  validatedDriverEmail: string | null;
  quoteEmail: string;
  myQuotes: Array<{ email: string }>;
  onTripStatusUpdate: (status: string) => void;
  onDriverResponseStatusUpdate: (status: 'accepted' | 'rejected' | null) => void;
  onDriverEmailUpdate: (email: string | null) => void;
  onQuoteSuccessUpdate: (success: boolean) => void;
  onQuoteSuccessMessageUpdate: (message: string) => void;
  onShowSignupModal: () => void;
  onShowDriverAssignmentInfoModal: () => void;
  onShowDriverConfirmDialogClose: () => void;
  onShowDriverAcceptRejectModalClose: () => void;
  onShowDriverRejectDialogClose: () => void;
}

export interface UseDriverActionsReturn {
  confirmingTrip: boolean;
  rejectingTrip: boolean;
  handleDriverConfirmTrip: () => Promise<void>;
  handleDriverRejectTrip: () => Promise<void>;
}

/**
 * Hook for driver actions (confirm/reject trip)
 */
export function useDriverActions({
  tripId,
  driverToken,
  isAuthenticated,
  canTakeAction,
  validatedDriverEmail,
  quoteEmail,
  myQuotes,
  onTripStatusUpdate,
  onDriverResponseStatusUpdate,
  onDriverEmailUpdate,
  onQuoteSuccessUpdate,
  onQuoteSuccessMessageUpdate,
  onShowSignupModal,
  onShowDriverAssignmentInfoModal,
  onShowDriverConfirmDialogClose,
  onShowDriverAcceptRejectModalClose,
  onShowDriverRejectDialogClose,
}: UseDriverActionsParams): UseDriverActionsReturn {
  const [confirmingTrip, setConfirmingTrip] = useState<boolean>(false);
  const [rejectingTrip, setRejectingTrip] = useState<boolean>(false);

  // Handler for driver to confirm a pending trip
  const handleDriverConfirmTrip = useCallback(async () => {
    // Don't require authentication for assigned drivers - they can use token to accept/reject
    // Only check authentication if not using token
    if (!driverToken && !isAuthenticated) {
      onShowSignupModal();
      return;
    }

    if (!tripId || confirmingTrip) return;

    // If driver has token and action already taken, show assignment info modal instead
    if (driverToken && !canTakeAction) {
      onShowDriverAssignmentInfoModal();
      return;
    }

    // If driver has token and no quote exists, show message asking to quote first
    if (driverToken && myQuotes.length === 0) {
      alert('Please submit a quote for this trip before confirming. Use the quote form above to provide your pricing.');
      return;
    }

    // Use validated email from token if available, otherwise use quote email
    const emailToUse = validatedDriverEmail || quoteEmail;
    if (!emailToUse) return;

    setConfirmingTrip(true);

    try {

      const response = await fetch('/api/driver-confirm-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          driverEmail: emailToUse,
          token: driverToken, // Include token if present (magic link flow)
        }),
      });

      const result = await response.json();

      if (result.success) {
        onShowDriverConfirmDialogClose();
        onShowDriverAcceptRejectModalClose();
        // Update local state immediately
        onTripStatusUpdate('confirmed');
        onDriverResponseStatusUpdate('accepted');
        // Show success message
        onQuoteSuccessUpdate(true);
        onQuoteSuccessMessageUpdate('✅ Confirmed! The trip owner has been notified.');
      } else {
        alert(result.error || 'Failed to confirm trip');
      }
    } catch (err) {
      alert('Failed to confirm trip. Please try again.');
    } finally {
      setConfirmingTrip(false);
    }
  }, [
    tripId,
    driverToken,
    isAuthenticated,
    canTakeAction,
    validatedDriverEmail,
    quoteEmail,
    myQuotes.length,
    confirmingTrip,
    onShowSignupModal,
    onShowDriverAssignmentInfoModal,
    onShowDriverConfirmDialogClose,
    onShowDriverAcceptRejectModalClose,
    onTripStatusUpdate,
    onDriverResponseStatusUpdate,
    onQuoteSuccessUpdate,
    onQuoteSuccessMessageUpdate,
  ]);

  // Handler for driver to reject a pending trip
  const handleDriverRejectTrip = useCallback(async () => {
    if (!tripId || !driverToken || rejectingTrip) return;

    // Block action if token was already used or trip not pending
    if (!canTakeAction) {
      alert('This trip has already been responded to or is no longer available.');
      return;
    }

    setRejectingTrip(true);

    try {

      const response = await fetch('/api/driver-reject-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          token: driverToken,
        }),
      });

      const result = await response.json();

      if (result.success) {
        onShowDriverRejectDialogClose();
        onShowDriverAcceptRejectModalClose();
        // Update local state immediately
        onTripStatusUpdate('rejected');
        onDriverResponseStatusUpdate('rejected');
        onDriverEmailUpdate(null); // Clear driver assignment
        // Show success message
        onQuoteSuccessUpdate(true);
        onQuoteSuccessMessageUpdate('Trip declined. The trip owner has been notified.');
      } else {
        alert(result.error || 'Failed to reject trip');
      }
    } catch (err) {
      alert('Failed to reject trip. Please try again.');
    } finally {
      setRejectingTrip(false);
    }
  }, [
    tripId,
    driverToken,
    canTakeAction,
    rejectingTrip,
    onShowDriverRejectDialogClose,
    onShowDriverAcceptRejectModalClose,
    onTripStatusUpdate,
    onDriverResponseStatusUpdate,
    onDriverEmailUpdate,
    onQuoteSuccessUpdate,
    onQuoteSuccessMessageUpdate,
  ]);

  return {
    confirmingTrip,
    rejectingTrip,
    handleDriverConfirmTrip,
    handleDriverRejectTrip,
  };
}

