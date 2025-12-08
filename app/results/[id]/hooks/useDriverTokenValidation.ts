/**
 * useDriverTokenValidation Hook
 * 
 * Handles driver token validation from URL (magic link authentication).
 * Validates the token, sets driver view state, and determines if driver can take action.
 */

import { useState, useEffect } from 'react';
import { safeJsonParse } from '@/lib/helpers/api-helpers';

export interface UseDriverTokenValidationParams {
  searchParams: URLSearchParams;
  tripId: string;
  loading: boolean;
  onEmailPreFill?: (email: string) => void;
}

export interface UseDriverTokenValidationReturn {
  driverToken: string | null;
  validatedDriverEmail: string | null;
  isDriverView: boolean;
  canTakeAction: boolean;
  tokenValidationError: string | null;
  tokenAlreadyUsed: boolean;
  tokenMessage: string | null;
  driverResponseStatus: 'accepted' | 'rejected' | null;
  setDriverResponseStatus: (status: 'accepted' | 'rejected' | null) => void;
  setValidatedDriverEmail: (email: string | null) => void;
}

/**
 * Hook to validate driver token from URL and manage driver view state
 */
export function useDriverTokenValidation({
  searchParams,
  tripId,
  loading,
  onEmailPreFill,
}: UseDriverTokenValidationParams): UseDriverTokenValidationReturn {
  const [driverToken, setDriverToken] = useState<string | null>(null);
  const [validatedDriverEmail, setValidatedDriverEmail] = useState<string | null>(null);
  const [isDriverView, setIsDriverView] = useState<boolean>(false);
  const [tokenValidationError, setTokenValidationError] = useState<string | null>(null);
  const [tokenAlreadyUsed, setTokenAlreadyUsed] = useState<boolean>(false);
  const [tokenMessage, setTokenMessage] = useState<string | null>(null);
  const [canTakeAction, setCanTakeAction] = useState<boolean>(false);
  const [driverResponseStatus, setDriverResponseStatus] = useState<'accepted' | 'rejected' | null>(null);

  useEffect(() => {
    const token = searchParams.get('driver_token');

    if (!token || !tripId || loading) return;

    setDriverToken(token);

    async function validateToken() {
      try {
        const response = await fetch('/api/validate-driver-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: token,
            tripId: tripId,
          }),
        });

        const result = await safeJsonParse(response);

        if (result.success) {
          // Determine canTakeAction explicitly - be very explicit about the logic
          // API returns canTakeAction: true when trip is pending and token not used
          // If API doesn't return it, calculate it ourselves as fallback
          let canTakeActionValue: boolean;
          if (result.canTakeAction !== undefined && result.canTakeAction !== null) {
            // Use explicit value from API (handle both boolean true and string "true")
            canTakeActionValue = result.canTakeAction === true || result.canTakeAction === 'true';
          } else {
            // Fallback: calculate based on trip status and token usage
            canTakeActionValue = result.tripStatus === 'pending' && !result.tokenUsed;
          }

          setValidatedDriverEmail(result.driverEmail);
          setIsDriverView(true);
          if (onEmailPreFill) {
            onEmailPreFill(result.driverEmail); // Pre-fill email for convenience
          }
          setTokenValidationError(null);
          setTokenAlreadyUsed(result.tokenUsed || false);
          setTokenMessage(result.message || null);
          setCanTakeAction(canTakeActionValue);
          
          // Initialize driver response status based on trip status
          if (result.tripStatus === 'confirmed') {
            setDriverResponseStatus('accepted');
          } else if (result.tripStatus === 'rejected') {
            setDriverResponseStatus('rejected');
          } else {
            setDriverResponseStatus(null);
          }
        } else {
          setTokenValidationError(result.error || 'Invalid or expired link');
          setIsDriverView(false);
        }
      } catch (err) {
        setTokenValidationError('Failed to validate link. Please try again.');
        setIsDriverView(false);
      }
    }

    validateToken();
  }, [searchParams, tripId, loading, onEmailPreFill]);

  return {
    driverToken,
    validatedDriverEmail,
    isDriverView,
    canTakeAction,
    tokenValidationError,
    tokenAlreadyUsed,
    tokenMessage,
    driverResponseStatus,
    setDriverResponseStatus,
    setValidatedDriverEmail,
  };
}

