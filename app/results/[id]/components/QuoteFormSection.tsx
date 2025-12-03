'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatPriceDisplay, parsePriceInput } from '../utils/price-helpers';
import { CURRENCY_OPTIONS } from '../constants';

interface QuoteFormSectionProps {
  scrollY: number;
  isOwner: boolean;
  isGuestCreator: boolean;
  isGuestCreatedTrip: boolean;
  isDriverView: boolean;
  driverToken: string | null;
  quoteEmail: string;
  quoteDriverName: string;
  quotePrice: string;
  quoteCurrency: string;
  quoteEmailError: string | null;
  quotePriceError: string | null;
  submittingQuote: boolean;
  myQuotes: Array<{
    id: string;
    email: string;
    driver_name?: string | null;
    price: number;
    currency: string;
  }>;
  isEmailFromUrl: boolean;
  onEmailChange: (value: string) => void;
  onDriverNameChange: (value: string) => void;
  onPriceChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function QuoteFormSection({
  scrollY,
  isOwner,
  isGuestCreator,
  isGuestCreatedTrip,
  isDriverView,
  driverToken,
  quoteEmail,
  quoteDriverName,
  quotePrice,
  quoteCurrency,
  quoteEmailError,
  quotePriceError,
  submittingQuote,
  myQuotes,
  isEmailFromUrl,
  onEmailChange,
  onDriverNameChange,
  onPriceChange,
  onCurrencyChange,
  onSubmit,
}: QuoteFormSectionProps) {
  // Don't render if user is owner, guest creator, or guest-created trip
  // Also don't render if driver view without token
  if (isOwner || isGuestCreator || isGuestCreatedTrip || (isDriverView && !driverToken)) {
    return null;
  }

  return (
    <div
      className={`fixed left-0 right-0 bg-background transition-all duration-300 ${scrollY > 0 ? 'top-0 z-[60]' : 'top-[57px] z-40'
        }`}
    >
      <div className="container mx-auto px-4 pt-8 pb-3">
        <div className={`rounded-md pl-6 pr-4 py-3 bg-primary dark:bg-[#1f1f21] border ${myQuotes.length === 0 && (!quotePrice || quotePrice.trim() === '') ? 'border-[#e77500]' : 'border-border'}`}>
          {/* Always show the same structure - fields are disabled when quote exists */}
          <form onSubmit={onSubmit} className="flex gap-3 items-start">
            <label className="flex-1">
              <span className="block text-sm text-white font-medium mb-1">Driver email</span>
              <Input
                id="quote-email"
                type="email"
                value={myQuotes.length > 0 ? (quoteEmail || myQuotes[0].email) : quoteEmail}
                onChange={(e) => {
                  if (myQuotes.length === 0 && !isEmailFromUrl && !(isDriverView && !!driverToken)) {
                    onEmailChange(e.target.value);
                  }
                }}
                placeholder="your.email@company.com"
                disabled={myQuotes.length > 0 || submittingQuote || isEmailFromUrl || (isDriverView && !!driverToken)}
                readOnly={myQuotes.length > 0 || isEmailFromUrl || (isDriverView && !!driverToken)}
                className={`h-[44px] border-border bg-background dark:bg-input/30 text-foreground placeholder:text-muted-foreground/60 dark:hover:bg-[#323236] transition-colors ${quoteEmailError ? 'border-destructive' : ''} ${(myQuotes.length > 0 || isEmailFromUrl || (isDriverView && !!driverToken)) ? 'cursor-not-allowed opacity-75' : ''}`}
              />
              {quoteEmailError && (
                <p className="text-xs text-destructive mt-1">{quoteEmailError}</p>
              )}
            </label>

            <label className="flex-[1.5]">
              <span className="block text-sm text-white font-medium mb-1">Driver name</span>
              <Input
                id="quote-driver-name"
                type="text"
                value={myQuotes.length > 0 ? (myQuotes[0].driver_name || 'N/A') : quoteDriverName}
                onChange={(e) => {
                  if (myQuotes.length === 0) {
                    onDriverNameChange(e.target.value);
                  }
                }}
                placeholder="John Doe"
                disabled={myQuotes.length > 0 || submittingQuote}
                readOnly={myQuotes.length > 0}
                className={`h-[44px] border-border bg-background dark:bg-input/30 text-foreground placeholder:text-muted-foreground/60 dark:hover:bg-[#323236] transition-colors ${myQuotes.length > 0 ? 'cursor-not-allowed opacity-75' : ''}`}
              />
            </label>

            <label className="w-[120px]">
              <span className="block text-sm text-white font-medium mb-1">Total</span>
              <Input
                id="quote-price"
                type="text"
                value={myQuotes.length > 0 ? `${myQuotes[0].currency} ${myQuotes[0].price.toFixed(2)}` : (quotePrice ? formatPriceDisplay(quotePrice) : '')}
                onChange={(e) => {
                  if (myQuotes.length === 0) {
                    const parsed = parsePriceInput(e.target.value);
                    onPriceChange(parsed);
                  }
                }}
                placeholder="100.00"
                disabled={myQuotes.length > 0 || submittingQuote}
                readOnly={myQuotes.length > 0}
                className={`h-[44px] border-border bg-background dark:bg-input/30 text-foreground placeholder:text-muted-foreground/60 dark:hover:bg-[#323236] transition-colors ${quotePriceError ? 'border-destructive' : ''} ${myQuotes.length > 0 ? 'cursor-not-allowed opacity-75' : ''}`}
              />
              {quotePriceError && (
                <p className="text-xs text-destructive mt-1">{quotePriceError}</p>
              )}
            </label>

            <label className="w-[110px]">
              <span className="block text-sm text-white font-medium mb-1">Currency</span>
              <select
                id="quote-currency"
                value={myQuotes.length > 0 ? myQuotes[0].currency : quoteCurrency}
                onChange={(e) => {
                  if (myQuotes.length === 0) {
                    onCurrencyChange(e.target.value);
                  }
                }}
                disabled={myQuotes.length > 0 || submittingQuote}
                className={`w-full h-[44px] pl-3 pr-3 rounded-md border border-border bg-background dark:bg-input/30 text-sm text-foreground dark:hover:bg-[#323236] transition-colors appearance-none focus:outline-none focus:ring-0 ${myQuotes.length > 0 ? 'cursor-not-allowed opacity-75' : ''}`}
              >
                {CURRENCY_OPTIONS.map(currency => (
                  <option key={currency} value={currency}>{currency}</option>
                ))}
              </select>
            </label>

            <label className="w-[110px]">
              <span className="block text-sm text-white font-medium mb-1">&nbsp;</span>
              {myQuotes.length > 0 ? (
                <Button
                  type="button"
                  disabled={true}
                  className="w-full h-[44px] bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] cursor-not-allowed opacity-50"
                >
                  Submitted
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={submittingQuote || !quoteEmail || !quotePrice}
                  className="w-full h-[44px] bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] hover:bg-[#05060A]/90 dark:hover:bg-[#E5E7EF]/90"
                >
                  {submittingQuote ? (
                    <>
                      <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    'Submit quote'
                  )}
                </Button>
              )}
            </label>
          </form>
        </div>
      </div>
    </div>
  );
}

