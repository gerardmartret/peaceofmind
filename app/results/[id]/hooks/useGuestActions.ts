/**
 * useGuestActions Hook
 * 
 * Handles guest user actions:
 * - Guest signup (converting guest account to authenticated account)
 * - Linking guest trips to new authenticated account
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { TripData } from '../types';

export interface UseGuestActionsParams {
  tripData: TripData | null;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
}

export interface UseGuestActionsReturn {
  guestSignupPassword: string;
  guestSignupError: string | null;
  guestSignupLoading: boolean;
  guestSignupSuccess: boolean;
  setGuestSignupPassword: (password: string) => void;
  setGuestSignupError: (error: string | null) => void;
  setGuestSignupSuccess: (success: boolean) => void;
  handleGuestSignup: (e: React.FormEvent) => Promise<void>;
}

/**
 * Hook for guest user actions (signup, account linking)
 */
export function useGuestActions({
  tripData,
  signUp,
}: UseGuestActionsParams): UseGuestActionsReturn {
  const [guestSignupPassword, setGuestSignupPassword] = useState<string>('');
  const [guestSignupError, setGuestSignupError] = useState<string | null>(null);
  const [guestSignupLoading, setGuestSignupLoading] = useState<boolean>(false);
  const [guestSignupSuccess, setGuestSignupSuccess] = useState<boolean>(false);

  const handleGuestSignup = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setGuestSignupError(null);

    // Validation
    if (!guestSignupPassword || guestSignupPassword.length < 6) {
      setGuestSignupError('Password must be at least 6 characters');
      return;
    }

    if (!tripData?.userEmail) {
      setGuestSignupError('Email not found. Please try again.');
      return;
    }

    setGuestSignupLoading(true);

    try {
      // Create auth user with email and password
      const { error: signUpError } = await signUp(tripData.userEmail, guestSignupPassword);

      if (signUpError) {
        // Handle specific errors
        if (signUpError.message.toLowerCase().includes('already registered') ||
          signUpError.message.toLowerCase().includes('already exists')) {
          setGuestSignupError(`This email already has an account. Please login instead.`);
        } else {
          setGuestSignupError(signUpError.message);
        }
        setGuestSignupLoading(false);
        return;
      }

      // Wait a moment for auth state to update
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get the session to get user ID
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user?.id) {
        // Update ALL trips with this email to link to new user
        const { error: updateError } = await supabase
          .from('trips')
          .update({ user_id: session.user.id })
          .eq('user_email', tripData.userEmail)
          .is('user_id', null);

        if (updateError) {
          console.error('Error linking trips to user:', updateError);
        } else {
          console.log('✅ All guest trips linked to new account');
        }

        // Clear sessionStorage
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('guestCreatedTripId');
        }

        // Show success and refresh page
        setGuestSignupSuccess(true);
        setGuestSignupError(null);

        // Refresh the page after 2 seconds to show owner UI
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setGuestSignupError('Something went wrong. Please try logging in.');
      }
    } catch (err) {
      console.error('Unexpected signup error:', err);
      setGuestSignupError('An unexpected error occurred. Please try again.');
    } finally {
      setGuestSignupLoading(false);
    }
  }, [tripData, guestSignupPassword, signUp]);

  return {
    guestSignupPassword,
    guestSignupError,
    guestSignupLoading,
    guestSignupSuccess,
    setGuestSignupPassword,
    setGuestSignupError,
    setGuestSignupSuccess,
    handleGuestSignup,
  };
}

