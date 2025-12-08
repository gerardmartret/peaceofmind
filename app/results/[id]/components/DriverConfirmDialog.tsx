/**
 * DriverConfirmDialog Component
 * 
 * Dialog for drivers to confirm they accept a trip assignment.
 * Shows information about what will happen when they confirm.
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface DriverConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  confirmingTrip: boolean;
  onConfirm: () => void;
}

export function DriverConfirmDialog({
  open,
  onOpenChange,
  confirmingTrip,
  onConfirm,
}: DriverConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Confirm trip</DialogTitle>
          <DialogDescription>
            You're about to confirm this trip
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
                This will notify the trip owner that you've accepted this trip.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                The trip status will change from Pending to Confirmed.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={confirmingTrip}
          >
            Dismiss
          </Button>
          <Button
            onClick={onConfirm}
            disabled={confirmingTrip}
            className="bg-[#3ea34b] hover:bg-[#3ea34b]/90 text-white"
          >
            {confirmingTrip ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Confirming...
              </>
            ) : (
              'Yes, confirm'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

