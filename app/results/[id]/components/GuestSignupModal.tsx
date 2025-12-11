/**
 * GuestSignupModal Component
 * 
 * Modal for guest users to create an account and link their trips.
 * Shown when non-authenticated users try to use features that require authentication.
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface GuestSignupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string | null;
  guestSignupPassword: string;
  guestSignupError: string | null;
  guestSignupLoading: boolean;
  guestSignupSuccess: boolean;
  onPasswordChange: (password: string) => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
}

export function GuestSignupModal({
  open,
  onOpenChange,
  userEmail,
  guestSignupPassword,
  guestSignupError,
  guestSignupLoading,
  guestSignupSuccess,
  onPasswordChange,
  onSubmit,
}: GuestSignupModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            Chauffs is free - start saving time now.
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {guestSignupSuccess ? (
            <div className="text-center space-y-4">
              <div className="text-6xl">✅</div>
              <h3 className="text-xl font-semibold">Account created successfully!</h3>
              <p className="text-muted-foreground">
                Your trip has been linked to your new account. The page will refresh shortly...
              </p>
            </div>
          ) : (
            <>
              {/* Benefits Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-5 h-5 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Unlimited trips</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-5 h-5 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Instant fixed pricing</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-5 h-5 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Pick your driver</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-5 h-5 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Edit trips instantly</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-5 h-5 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Billed in seconds</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <svg className="w-5 h-5 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Secure payments</span>
                </div>
              </div>

              {/* Signup Form */}
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label htmlFor="modal-guest-email" className="block text-sm font-medium mb-2">
                    Email address
                  </label>
                  <Input
                    id="modal-guest-email"
                    type="email"
                    value={userEmail || ''}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div>
                  <label htmlFor="modal-guest-password" className="block text-sm font-medium mb-2">
                    Create password
                  </label>
                  <Input
                    id="modal-guest-password"
                    type="password"
                    value={guestSignupPassword}
                    onChange={(e) => onPasswordChange(e.target.value)}
                    placeholder="At least 8 characters"
                    disabled={guestSignupLoading}
                    className={guestSignupError ? 'border-destructive' : ''}
                  />
                  {guestSignupError ? (
                    <p className="text-sm text-destructive mt-1">{guestSignupError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      Must be at least 8 characters and include lowercase, uppercase letters, and digits.
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full text-lg py-6 bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
                  disabled={guestSignupLoading || !guestSignupPassword}
                >
                  {guestSignupLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creating Account...
                    </>
                  ) : (
                    <>
                      Create account and save trip
                    </>
                  )}
                </Button>
              </form>

              <p className="text-xs text-center text-muted-foreground">
                Already have an account? <a href="/login" className="text-primary hover:underline dark:text-white">Log in here</a>
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

