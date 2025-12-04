/**
 * UpdateNotificationModal Component
 * 
 * Modal shown after trip updates, asking if the owner wants to notify the driver.
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface UpdateNotificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sendingUpdateNotification: boolean;
  onResponse: (notify: boolean) => void;
}

export function UpdateNotificationModal({
  open,
  onOpenChange,
  sendingUpdateNotification,
  onResponse,
}: UpdateNotificationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trip Updated</DialogTitle>
          <DialogDescription>
            The trip was updated successfully.
            <br /><br />
            Do you want to notify the driver about these changes?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onResponse(false)}
            disabled={sendingUpdateNotification}
          >
            No
          </Button>
          <Button
            onClick={() => onResponse(true)}
            disabled={sendingUpdateNotification}
            className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
          >
            {sendingUpdateNotification ? (
              <>
                <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Sending...
              </>
            ) : (
              'Yes, Notify Driver'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

