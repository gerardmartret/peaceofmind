/**
 * DriverAssignmentInfoModal Component
 * 
 * Modal shown to drivers when they've already responded to a trip assignment.
 * Displays the current trip status and assignment information.
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface DriverAssignmentInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripStatus: string | null;
  validatedDriverEmail: string | null;
  tokenMessage: string | null;
}

export function DriverAssignmentInfoModal({
  open,
  onOpenChange,
  tripStatus,
  validatedDriverEmail,
  tokenMessage,
}: DriverAssignmentInfoModalProps) {
  const getStatusAlertClass = () => {
    if (tripStatus === 'confirmed' || tripStatus === 'booked') {
      return 'bg-[#3ea34b]/10 border-[#3ea34b]/30';
    }
    if (tripStatus === 'rejected') {
      return 'bg-red-500/10 border-red-500/30';
    }
    if (tripStatus === 'cancelled') {
      return 'bg-gray-500/10 border-gray-500/30';
    }
    return 'bg-blue-500/10 border-blue-500/30';
  };

  const getStatusTextClass = () => {
    if (tripStatus === 'confirmed' || tripStatus === 'booked') {
      return 'text-[#3ea34b]';
    }
    if (tripStatus === 'rejected') {
      return 'text-red-600';
    }
    if (tripStatus === 'cancelled') {
      return 'text-gray-600';
    }
    return 'text-blue-600';
  };

  const getStatusMessage = () => {
    if (tripStatus === 'confirmed') return '✅ You have confirmed this trip';
    if (tripStatus === 'booked') return '✅ This trip has been booked';
    if (tripStatus === 'rejected') return '❌ You have rejected this trip';
    if (tripStatus === 'cancelled') return '🚫 This trip has been cancelled';
    if (tokenMessage && !['confirmed', 'booked', 'rejected', 'cancelled'].includes(tripStatus || '')) {
      return `ℹ️ ${tokenMessage}`;
    }
    return null;
  };

  const getStatusDescription = () => {
    if (tripStatus === 'confirmed') return 'The trip owner has been notified of your acceptance.';
    if (tripStatus === 'booked') return 'Your booking request has been sent to Drivania.';
    if (tripStatus === 'rejected') return 'The trip owner has been notified that you declined.';
    if (tripStatus === 'cancelled') return 'The trip owner has cancelled this trip.';
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Trip status update</DialogTitle>
          <DialogDescription>
            You've already responded to this trip
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Alert className={`mb-4 ${getStatusAlertClass()}`}>
            <AlertDescription className={`font-medium ${getStatusTextClass()}`}>
              {getStatusMessage()}
            </AlertDescription>
          </Alert>

          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm mb-3">
              <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-muted-foreground">Assigned to:</span>
              <span className="font-medium">{validatedDriverEmail === 'drivania' ? 'Drivania' : validatedDriverEmail}</span>
            </div>
            {getStatusDescription() && (
              <div className="text-sm text-muted-foreground">
                {getStatusDescription()}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

