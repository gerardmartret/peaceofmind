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
  signUp: (email: string, password: string) => Promise<{ data: any; error: any }>;
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
    if (!guestSignupPassword || guestSignupPassword.length < 8) {
      setGuestSignupError('Password must be at least 8 characters');
      return;
    }

    if (!tripData?.userEmail) {
      setGuestSignupError('Email not found. Please try again.');
      return;
    }

    setGuestSignupLoading(true);

    try {
      // Create auth user with email and password
      const { data: signUpData, error: signUpError } = await signUp(tripData.userEmail, guestSignupPassword);

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

      // Check if user was created (even if session is not available yet due to email confirmation)
      if (signUpData?.user?.id) {
        const userId = signUpData.user.id;

        // Update ALL trips with this email to link to new user
        const { error: updateError } = await supabase
          .from('trips')
          .update({ user_id: userId })
          .eq('user_email', tripData.userEmail)
          .is('user_id', null);

        if (updateError) {
          // Log error but continue - user was created successfully
          if (process.env.NODE_ENV === 'development') {
            console.error('❌ Error updating trips.user_id:', updateError);
          }
        }

        // Update users table: convert guest to authenticated
        const { error: userUpdateError } = await supabase
          .from('users')
          .update({ auth_user_id: userId })
          .eq('email', tripData.userEmail)
          .is('auth_user_id', null); // Only update if currently a guest

        if (userUpdateError) {
          // Log error but don't fail - trip linking is more critical
          if (process.env.NODE_ENV === 'development') {
            console.error('❌ Error updating users.auth_user_id:', userUpdateError);
          }
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
        // User was not created - this shouldn't happen if signUp succeeded
        setGuestSignupError('Something went wrong. Please try logging in.');
      }
    } catch (err) {
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

