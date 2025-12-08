/**
 * FlowAModal Component
 * 
 * Modal for confirming driver assignment from quotes.
 * Flow A is for Supabase driver assignment - Drivania quotes should not be shown here.
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface FlowAModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAuthenticated: boolean;
  selectedQuoteDriver: string | null;
  settingDriver: boolean;
  tripId: string | null;
  onDismiss: () => void;
  onShowSignup: () => void;
  onSetDriver: (driver: string) => Promise<void>;
  onStatusUpdate: (status: string) => void;
  onCloseDriverModal: () => void;
  onError: (error: string) => void;
}

export function FlowAModal({
  open,
  onOpenChange,
  isAuthenticated,
  selectedQuoteDriver,
  settingDriver,
  tripId,
  onDismiss,
  onShowSignup,
  onSetDriver,
  onStatusUpdate,
  onCloseDriverModal,
  onError,
}: FlowAModalProps) {
  const handleConfirm = async () => {
    // Check if user is authenticated - if not, show signup modal
    if (!isAuthenticated) {
      onOpenChange(false);
      onShowSignup();
      return;
    }

    if (!selectedQuoteDriver) return;

    try {
      // Use the hook's handleSetDriver function
      await onSetDriver(selectedQuoteDriver);

      // Update status to pending (waiting for driver acceptance)
      if (tripId) {
        const statusResponse = await fetch('/api/update-trip-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId: tripId,
            status: 'pending',
          }),
        });

        const statusResult = await statusResponse.json();
        if (statusResult.success) {
          onStatusUpdate('pending');
        }
      }

      // Note: Email is automatically sent by /api/set-driver route, no need to send here

      // Close both modals
      onOpenChange(false);
      onCloseDriverModal();
      onDismiss();
    } catch (err) {
      onError('An error occurred');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign driver</DialogTitle>
          <DialogDescription>
            Assigning this driver will set the trip to pending status and send them an acceptance request email.
          </DialogDescription>
        </DialogHeader>
        {/* Flow A is for Supabase driver assignment - Drivania quotes should not be shown here */}
        {/* (Drivania quotes are only relevant when booking with Drivania, not when assigning Supabase drivers) */}
        <DialogFooter className="justify-start">
          <Button
            variant="outline"
            onClick={onDismiss}
            disabled={settingDriver}
          >
            Dismiss
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={settingDriver}
            className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
          >
            {settingDriver ? (
              <>
                <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Confirming...
              </>
            ) : (
              'Confirm trip'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

