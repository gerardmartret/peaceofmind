/**
 * DriverAcceptRejectModal Component
 * 
 * Modal shown to drivers when they're assigned to a trip, allowing them to accept or reject.
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface DriverAcceptRejectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  confirmingTrip: boolean;
  rejectingTrip: boolean;
  onAccept: () => Promise<void>;
  onReject: () => Promise<void>;
}

export function DriverAcceptRejectModal({
  open,
  onOpenChange,
  confirmingTrip,
  rejectingTrip,
  onAccept,
  onReject,
}: DriverAcceptRejectModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader className="relative">
          <button
            onClick={() => onOpenChange(false)}
            disabled={confirmingTrip || rejectingTrip}
            className="absolute right-0 top-0 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="sr-only">Close</span>
          </button>
          <DialogTitle>Accept or reject trip</DialogTitle>
          <DialogDescription>
            You've been assigned as the driver to this trip
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#e77500]/10 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-[#e77500]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">
                You can accept or reject this trip assignment.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                If you accept, the trip status will change to Confirmed. If you reject, the trip owner will be notified.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-3 sm:justify-end">
          <Button
            variant="outline"
            onClick={async () => {
              onOpenChange(false);
              await onReject();
            }}
            disabled={confirmingTrip || rejectingTrip}
          >
            {rejectingTrip ? (
              <>
                <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Rejecting...
              </>
            ) : (
              'Reject trip'
            )}
          </Button>
          <Button
            onClick={async () => {
              onOpenChange(false);
              await onAccept();
            }}
            disabled={confirmingTrip || rejectingTrip}
            className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] hover:bg-[#05060A]/90 dark:hover:bg-[#E5E7EF]/90"
          >
            {confirmingTrip ? (
              <>
                <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Accepting...
              </>
            ) : (
              'Accept trip'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

