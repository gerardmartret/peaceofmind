/**
 * useQuotes Hook
 * 
 * Handles quote fetching and realtime subscriptions:
 * - Fetches all quotes (for owners)
 * - Fetches driver's own quotes (for drivers)
 * - Subscribes to realtime quote updates
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { safeJsonParse } from '@/lib/helpers/api-helpers';

export interface Quote {
  id: string;
  email: string;
  driver_name: string | null;
  price: number;
  currency: string;
  created_at: string;
}

export interface UseQuotesParams {
  tripId: string;
  isOwner: boolean;
  loading: boolean;
  ownershipChecked: boolean;
  // For driver quotes
  driverEmail?: string | null;
  quoteEmail?: string;
  validatedDriverEmail?: string | null;
  // Callbacks
  onQuoteEmailSet?: (email: string) => void;
}

export interface UseQuotesReturn {
  // Owner quotes
  quotes: Quote[];
  loadingQuotes: boolean;
  fetchQuotes: () => Promise<void>;
  // Driver quotes
  myQuotes: Quote[];
  loadingMyQuotes: boolean;
  fetchMyQuotes: (email: string) => Promise<void>;
}

/**
 * Hook to manage quotes fetching and realtime subscriptions
 */
export function useQuotes({
  tripId,
  isOwner,
  loading,
  ownershipChecked,
  driverEmail,
  quoteEmail,
  validatedDriverEmail,
  onQuoteEmailSet,
}: UseQuotesParams): UseQuotesReturn {
  // Owner quotes state
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState<boolean>(false);

  // Driver quotes state
  const [myQuotes, setMyQuotes] = useState<Quote[]>([]);
  const [loadingMyQuotes, setLoadingMyQuotes] = useState<boolean>(false);

  // Fetch all quotes (for owners)
  const fetchQuotes = useCallback(async () => {
    if (!tripId || !isOwner) return;

    setLoadingQuotes(true);
    try {
      const response = await fetch('/api/get-quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tripId: tripId,
        }),
      });

      // Handle non-JSON responses
      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
        } catch {
          // Not JSON, just log the text
        }
        return;
      }

      const result = await response.json();

      if (result.success) {
        // Deduplicate quotes: show only the latest quote per driver email
        const quotesArray = result.quotes || [];
        const quoteMap = new Map<string, typeof quotesArray[0]>();

        // Since quotes are already ordered by created_at DESC, first occurrence per email is the latest
        quotesArray.forEach((quote: any) => {
          const emailKey = quote.email.toLowerCase().trim();
          if (!quoteMap.has(emailKey)) {
            quoteMap.set(emailKey, quote);
          }
        });

        const deduplicatedQuotes = Array.from(quoteMap.values());
        setQuotes(deduplicatedQuotes);
      } else {
        if (result.details) {
        }
      }
    } catch (err) {
      if (err instanceof Error) {
      }
    } finally {
      setLoadingQuotes(false);
    }
  }, [tripId, isOwner]);

  // Fetch driver's own quotes (for non-owners)
  const fetchMyQuotes = useCallback(async (email: string) => {
    if (!tripId || !email) return;

    setLoadingMyQuotes(true);
    try {
      const response = await fetch('/api/get-quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tripId: tripId,
          driverEmail: email.trim(), // Filter by driver's email only
        }),
      });

      const result = await safeJsonParse(response);

      if (result.success) {
        // Get only the latest quote (first in array since ordered by created_at DESC)
        const quotesArray = result.quotes || [];
        setMyQuotes(quotesArray);
        // Set quoteEmail if not already set and we have a quote
        if (quotesArray.length > 0 && onQuoteEmailSet && !quoteEmail) {
          onQuoteEmailSet(quotesArray[0].email);
        }
      } else {
      }
    } catch (err) {
    } finally {
      setLoadingMyQuotes(false);
    }
  }, [tripId, quoteEmail, onQuoteEmailSet]);

  // Fetch quotes when page loads (for owners only)
  useEffect(() => {
    if (isOwner && tripId && !loading) {
      fetchQuotes();
    }
  }, [isOwner, tripId, loading, fetchQuotes]);

  // Fetch driver's quotes when page loads (for non-owners with email)
  useEffect(() => {
    if (!isOwner && tripId && !loading) {
      // Use validatedDriverEmail (from magic link) or quoteEmail (from form)
      const emailToFetch = validatedDriverEmail || quoteEmail;
      if (emailToFetch) {
        fetchMyQuotes(emailToFetch);
      }
    }
  }, [isOwner, tripId, loading, quoteEmail, validatedDriverEmail, fetchMyQuotes]);

  // Subscribe to quote updates (for real-time updates when driver submits quote)
  useEffect(() => {
    if (!tripId || !isOwner || loading || !ownershipChecked) return;


    const quotesChannel = supabase
      .channel(`quotes-${tripId}-${Date.now()}`) // Add timestamp to ensure unique channel
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'quotes',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          // Refresh quotes when any change occurs
          // Use a small delay to ensure database consistency
          setTimeout(() => {
            fetchQuotes();
          }, 200);
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
        } else if (status === 'CHANNEL_ERROR') {
          // Handle channel errors gracefully - connection issues are common and not critical
          if (err) {
          } else {
          }
        } else if (status === 'TIMED_OUT') {
        } else if (status === 'CLOSED') {
        }
      });

    return () => {
      try {
        supabase.removeChannel(quotesChannel);
      } catch (error) {
        // Silently handle cleanup errors - channel may already be closed
      }
    };
  }, [tripId, isOwner, loading, ownershipChecked, fetchQuotes]);

  return {
    quotes,
    loadingQuotes,
    fetchQuotes,
    myQuotes,
    loadingMyQuotes,
    fetchMyQuotes,
  };
}

