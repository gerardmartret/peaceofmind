/**
 * StatusChangeModal Component
 * 
 * Modal for trip owners to confirm or cancel trips, and resend confirmations to drivers.
 * Handles different states: no driver assigned, driver actions, and success messages.
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

export interface StatusChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driverEmail: string | null;
  tripStatus: string | null;
  tripId: string | null;
  tripDate: string | null;
  leadPassengerName: string | null;
  statusModalSuccess: string | null;
  resendingConfirmation: boolean;
  cancellingTrip: boolean;
  onClose: () => void;
  onStatusUpdate: (status: string) => void;
  onDriverEmailUpdate: (email: string | null) => void;
  onStatusModalSuccessUpdate: (message: string | null) => void;
  onResendingConfirmationUpdate: (value: boolean) => void;
  onCancellingTripUpdate: (value: boolean) => void;
}

export function StatusChangeModal({
  open,
  onOpenChange,
  driverEmail,
  tripStatus,
  tripId,
  tripDate,
  leadPassengerName,
  statusModalSuccess,
  resendingConfirmation,
  cancellingTrip,
  onClose,
  onStatusUpdate,
  onDriverEmailUpdate,
  onStatusModalSuccessUpdate,
  onResendingConfirmationUpdate,
  onCancellingTripUpdate,
}: StatusChangeModalProps) {
  const handleResendConfirmation = async () => {
    onResendingConfirmationUpdate(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // If status is "not confirmed", upgrade to "confirmed"
      if (tripStatus === 'not confirmed' && tripId) {
        const statusResponse = await fetch('/api/update-trip-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId: tripId,
            status: 'confirmed',
          }),
        });

        const statusResult = await statusResponse.json();
        if (statusResult.success) {
          onStatusUpdate('confirmed');
        }
      }

      // Send notification to driver with trip details
      if (driverEmail && tripId) {
        const notifyResponse = await fetch('/api/notify-status-change', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            tripId: tripId,
            newStatus: 'confirmed',
            driverEmail: driverEmail,
            tripDate: tripDate,
            leadPassengerName: leadPassengerName,
          }),
        });

        const notifyResult = await notifyResponse.json();

        // Show success message
        onStatusModalSuccessUpdate('Confirmation sent to driver successfully!');
      }
    } catch (err) {
      onStatusModalSuccessUpdate('Failed to send confirmation. Please try again.');
    } finally {
      onResendingConfirmationUpdate(false);
    }
  };

  const handleCancelTrip = async () => {
    onCancellingTripUpdate(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Capture driver email BEFORE any operations
      const driverToNotify = driverEmail;

      // STEP 1: Send cancellation notification to driver FIRST (before DB changes)
      if (driverToNotify && tripId) {
        const notifyResponse = await fetch('/api/notify-status-change', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            tripId: tripId,
            newStatus: 'cancelled',
            driverEmail: driverToNotify, // Use captured email, not the cleared one
            message: 'Trip cancelled',
            tripDate: tripDate,
            leadPassengerName: leadPassengerName,
          }),
        });

        const notifyResult = await notifyResponse.json();
      }

      // STEP 2: Now update trip status to cancelled (clears driver in DB)
      if (tripId) {
        const statusResponse = await fetch('/api/update-trip-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId: tripId,
            status: 'cancelled',
          }),
        });

        const statusResult = await statusResponse.json();

        if (statusResult.success) {
          onStatusUpdate('cancelled');
          onDriverEmailUpdate(null); // Clear driver assignment in UI

          // Show success message
          if (driverToNotify) {
            onStatusModalSuccessUpdate('Service cancelled successfully. Driver has been notified.');
          } else {
            onStatusModalSuccessUpdate('Service cancelled successfully.');
          }
        } else {
          onStatusModalSuccessUpdate(`Failed to cancel trip: ${statusResult.error || 'Unknown error'}`);
          onCancellingTripUpdate(false);
          return;
        }
      }
    } catch (err) {
      onStatusModalSuccessUpdate('Failed to cancel trip. Please try again.');
    } finally {
      onCancellingTripUpdate(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {/* Show "Trip actions" for pending state OR when unconfirming */}
            {driverEmail
              ? 'Trip actions'
              : 'Driver not allocated'}
          </DialogTitle>
          <DialogDescription>
            {statusModalSuccess ? (
              <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{statusModalSuccess}</span>
              </span>
            ) : driverEmail ? (
              <>
                Choose an action for this trip:
              </>
            ) : (
              <>
                Please allocate a driver before confirming the trip.
                <br /><br />
                Click the "Driver" button to open Driver Management and assign a driver.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {/* Show success close button */}
          {statusModalSuccess ? (
            <Button
              onClick={onClose}
              className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
            >
              Close
            </Button>
          ) : driverEmail ? (
            <>
              <Button
                onClick={handleCancelTrip}
                disabled={resendingConfirmation || cancellingTrip}
                variant={tripStatus === 'confirmed' ? 'destructive' : 'outline'}
              >
                {cancellingTrip ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Cancelling...
                  </>
                ) : (
                  'Cancel this trip'
                )}
              </Button>
              <Button
                onClick={handleResendConfirmation}
                disabled={resendingConfirmation || cancellingTrip}
                className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] hover:bg-[#05060A]/90 dark:hover:bg-[#E5E7EF]/90"
              >
                {resendingConfirmation ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Sending...
                  </>
                ) : (
                  'Resend confirmation to the driver'
                )}
              </Button>
            </>
          ) : (
            <Button
              onClick={onClose}
              className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
            >
              OK
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

