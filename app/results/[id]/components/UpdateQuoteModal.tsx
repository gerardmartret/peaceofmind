/**
 * UpdateQuoteModal Component
 * 
 * Modal for drivers to update their existing quote price.
 * Currency is locked to the original quote currency.
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Quote } from '../hooks/useQuotes';

export interface UpdateQuoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  myQuotes: Quote[];
  updateQuotePrice: string;
  updateQuotePriceError: string | null;
  updatingQuote: boolean;
  onUpdateQuotePriceChange: (price: string) => void;
  onUpdateQuote: () => Promise<void>;
  onDismiss: () => void;
}

export function UpdateQuoteModal({
  open,
  onOpenChange,
  myQuotes,
  updateQuotePrice,
  updateQuotePriceError,
  updatingQuote,
  onUpdateQuotePriceChange,
  onUpdateQuote,
  onDismiss,
}: UpdateQuoteModalProps) {
  const latestQuote = myQuotes[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update quote</DialogTitle>
          <DialogDescription>
            You're about to update the previous price. The trip owner will see your updated offer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {latestQuote && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Previous price</label>
                <div className="px-3 py-2 rounded-md border border-border bg-muted/50">
                  <p className="text-sm font-medium">
                    {latestQuote.currency} {latestQuote.price.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="update-quote-price" className="text-sm font-medium">
                  New price
                </label>
                <Input
                  id="update-quote-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={updateQuotePrice}
                  onChange={(e) => onUpdateQuotePriceChange(e.target.value)}
                  placeholder="Enter new price"
                  disabled={updatingQuote}
                  className={`h-[44px] ${updateQuotePriceError ? 'border-destructive' : ''}`}
                />
                {updateQuotePriceError && (
                  <p className="text-xs text-destructive">{updateQuotePriceError}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Currency</label>
                <div className="px-3 py-2 rounded-md border border-border bg-muted/50">
                  <p className="text-sm font-medium">{latestQuote.currency}</p>
                  <p className="text-xs text-muted-foreground mt-1">Currency cannot be changed</p>
                </div>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onDismiss}
            disabled={updatingQuote}
          >
            Dismiss
          </Button>
          <Button
            onClick={onUpdateQuote}
            disabled={updatingQuote || !updateQuotePrice}
            className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] hover:bg-[#05060A]/90 dark:hover:bg-[#E5E7EF]/90"
          >
            {updatingQuote ? (
              <>
                <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Updating...
              </>
            ) : (
              'Update'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

