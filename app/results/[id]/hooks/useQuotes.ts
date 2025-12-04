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
        console.error('❌ Failed to fetch quotes:', response.status, response.statusText);
        console.error('   Response body:', errorText);
        try {
          const errorJson = JSON.parse(errorText);
          console.error('   Error details:', errorJson);
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
        console.log(`✅ Fetched ${quotesArray.length} quotes, showing ${deduplicatedQuotes.length} unique driver quotes`);
      } else {
        console.error('❌ Failed to fetch quotes:', result.error);
        if (result.details) {
          console.error('   Error details:', result.details);
        }
      }
    } catch (err) {
      console.error('❌ Error fetching quotes:', err);
      if (err instanceof Error) {
        console.error('   Error message:', err.message);
        console.error('   Error stack:', err.stack);
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
        console.log(`✅ Fetched ${quotesArray.length} of my quotes, using latest: ${quotesArray[0] ? `${quotesArray[0].currency} ${quotesArray[0].price}` : 'none'}`);
      } else {
        console.error('❌ Failed to fetch my quotes:', result.error);
      }
    } catch (err) {
      console.error('❌ Error fetching my quotes:', err);
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

    console.log('🔄 Setting up realtime subscription for quote updates');

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
          console.log('🔄 Realtime quote update received:', payload);
          console.log('📊 Event type:', payload.eventType);
          console.log('📊 New/Updated quote:', payload.new);
          // Refresh quotes when any change occurs
          // Use a small delay to ensure database consistency
          setTimeout(() => {
            console.log('🔄 Refreshing quotes after realtime update...');
            fetchQuotes();
          }, 200);
        }
      )
      .subscribe((status, err) => {
        console.log('🔄 Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to quote updates for trip:', tripId);
        } else if (status === 'CHANNEL_ERROR') {
          // Handle channel errors gracefully - connection issues are common and not critical
          if (err) {
            console.warn('⚠️ Channel subscription error (non-critical):', err.message || err);
          } else {
            console.warn('⚠️ Channel subscription error (connection issue)');
          }
        } else if (status === 'TIMED_OUT') {
          console.warn('⚠️ Subscription timed out, retrying...');
        } else if (status === 'CLOSED') {
          console.log('🔄 Subscription closed');
        }
      });

    return () => {
      console.log('🔄 Cleaning up quotes subscription');
      try {
        supabase.removeChannel(quotesChannel);
      } catch (error) {
        // Silently handle cleanup errors - channel may already be closed
        console.debug('Channel cleanup:', error);
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

