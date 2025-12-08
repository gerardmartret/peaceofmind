/**
 * useUrlParams Hook
 * 
 * Handles URL parameters for quote requests:
 * - Scrolls to quote form if ?quote=true
 * - Pre-fills email from ?email= parameter
 * - Tracks if email came from URL
 */

import { useEffect, useState, RefObject } from 'react';

export interface UseUrlParamsParams {
  searchParams: URLSearchParams;
  isOwner: boolean;
  isGuestCreator: boolean;
  isGuestCreatedTrip: boolean;
  loading: boolean;
  quoteFormRef: RefObject<HTMLDivElement | null>;
  onEmailChange: (email: string) => void;
}

export interface UseUrlParamsReturn {
  quoteParam: string | null;
  emailParam: string | null;
  isEmailFromUrl: boolean;
}

/**
 * Hook to handle URL parameters for quote requests
 */
export function useUrlParams({
  searchParams,
  isOwner,
  isGuestCreator,
  isGuestCreatedTrip,
  loading,
  quoteFormRef,
  onEmailChange,
}: UseUrlParamsParams): UseUrlParamsReturn {
  const quoteParam = searchParams.get('quote');
  const emailParam = searchParams.get('email');
  const [isEmailFromUrl, setIsEmailFromUrl] = useState<boolean>(false);

  useEffect(() => {
    // Scroll to quote form if coming from quote request email
    if (quoteParam === 'true' && !isOwner && !isGuestCreator && !isGuestCreatedTrip && !loading && quoteFormRef.current) {
      // Wait a bit for page to fully render, then scroll
      setTimeout(() => {
        quoteFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 500);
    }

    // Pre-fill email from URL parameter if present
    if (emailParam && quoteParam === 'true' && !isOwner) {
      const decodedEmail = decodeURIComponent(emailParam);
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(decodedEmail)) {
        onEmailChange(decodedEmail);
        setIsEmailFromUrl(true);
      }
    }
  }, [quoteParam, emailParam, isOwner, isGuestCreator, isGuestCreatedTrip, loading, quoteFormRef, onEmailChange]);

  return {
    quoteParam,
    emailParam,
    isEmailFromUrl,
  };
}

