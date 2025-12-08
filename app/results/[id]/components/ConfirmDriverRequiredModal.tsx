/**
 * ConfirmDriverRequiredModal Component
 * 
 * Modal shown when user tries to confirm a trip without a driver assigned.
 * Prompts them to assign a driver first.
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface ConfirmDriverRequiredModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssignDriver: () => void;
}

export function ConfirmDriverRequiredModal({
  open,
  onOpenChange,
  onAssignDriver,
}: ConfirmDriverRequiredModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Driver required</DialogTitle>
          <DialogDescription>
            To confirm the trip, a driver must be assigned.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-3 sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Dismiss
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              onAssignDriver();
            }}
            className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] hover:bg-[#05060A]/90 dark:hover:bg-[#E5E7EF]/90"
          >
            Assign driver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

