/**
 * DriverRejectDialog Component
 * 
 * Dialog for drivers to reject/decline a trip assignment.
 * Shows warning information about what will happen when they reject.
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface DriverRejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rejectingTrip: boolean;
  onReject: () => void;
}

export function DriverRejectDialog({
  open,
  onOpenChange,
  rejectingTrip,
  onReject,
}: DriverRejectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Reject trip</DialogTitle>
          <DialogDescription>
            You're about to decline this trip assignment
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">
                This will notify the trip owner that you're declining this trip.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                The trip status will change to Rejected and you'll be unassigned.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={rejectingTrip}
          >
            Dismiss
          </Button>
          <Button
            onClick={onReject}
            disabled={rejectingTrip}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {rejectingTrip ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Rejecting...
              </>
            ) : (
              'Yes, reject'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

