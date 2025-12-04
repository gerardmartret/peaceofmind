/**
 * useQuoteSubmission Hook
 * 
 * Handles quote submission and management:
 * - Quote form submission with validation
 * - Quote updates
 * - Quote request sending (owner inviting drivers)
 * - Related state management
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { parsePriceInput } from '../utils/price-helpers';
import type { Quote } from './useQuotes';

export interface UseQuoteSubmissionParams {
  tripId: string | undefined;
  isOwner: boolean;
  driverEmail: string | null;
  quoteEmail: string;
  allocateDriverEmail: string;
  myQuotes: Quote[];
  fetchMyQuotes: (email: string) => Promise<void>;
  onQuoteEmailSet: (email: string) => void;
  onManualDriverEmailSet: (email: string) => void;
  onAllocateDriverEmailSet: (email: string) => void;
  sentDriverEmails: Array<{ email: string; sentAt: string }>;
  onSentDriverEmailsSet: (emails: Array<{ email: string; sentAt: string }>) => void;
}

export interface UseQuoteSubmissionReturn {
  // Quote form state
  quoteDriverName: string;
  quotePrice: string;
  quoteCurrency: string;
  quoteEmailError: string | null;
  quotePriceError: string | null;
  submittingQuote: boolean;
  quoteSuccess: boolean;
  quoteSuccessMessage: string;
  setQuoteDriverName: (name: string) => void;
  setQuotePrice: (price: string) => void;
  setQuoteCurrency: (currency: string) => void;
  setQuoteEmailError: (error: string | null) => void;
  setQuotePriceError: (error: string | null) => void;
  setQuoteSuccess: (success: boolean) => void;
  setQuoteSuccessMessage: (message: string) => void;
  
  // Quote update state
  showUpdateQuoteModal: boolean;
  updateQuotePrice: string;
  updateQuotePriceError: string | null;
  updatingQuote: boolean;
  setShowUpdateQuoteModal: (show: boolean) => void;
  setUpdateQuotePrice: (price: string) => void;
  setUpdateQuotePriceError: (error: string | null) => void;
  
  // Quote request state (for owners)
  sendingQuoteRequest: boolean;
  quoteRequestError: string | null;
  quoteRequestSuccess: string | null;
  setQuoteRequestError: (error: string | null) => void;
  setQuoteRequestSuccess: (success: string | null) => void;
  
  // Handlers
  handleSubmitQuote: (e: React.FormEvent) => Promise<void>;
  handleOpenUpdateQuote: () => void;
  handleUpdateQuote: () => Promise<void>;
  handleSendQuoteRequest: (emailToUse?: string) => Promise<void>;
}

/**
 * Hook for quote submission and management
 */
export function useQuoteSubmission({
  tripId,
  isOwner,
  driverEmail,
  quoteEmail,
  allocateDriverEmail,
  myQuotes,
  fetchMyQuotes,
  onQuoteEmailSet,
  onManualDriverEmailSet,
  onAllocateDriverEmailSet,
  sentDriverEmails,
  onSentDriverEmailsSet,
}: UseQuoteSubmissionParams): UseQuoteSubmissionReturn {
  // Quote form state
  const [quoteDriverName, setQuoteDriverName] = useState<string>('');
  const [quotePrice, setQuotePrice] = useState<string>('');
  const [quoteCurrency, setQuoteCurrency] = useState<string>('USD');
  const [quoteEmailError, setQuoteEmailError] = useState<string | null>(null);
  const [quotePriceError, setQuotePriceError] = useState<string | null>(null);
  const [submittingQuote, setSubmittingQuote] = useState<boolean>(false);
  const [quoteSuccess, setQuoteSuccess] = useState<boolean>(false);
  const [quoteSuccessMessage, setQuoteSuccessMessage] = useState<string>('Quote submitted successfully!');
  
  // Quote update state
  const [showUpdateQuoteModal, setShowUpdateQuoteModal] = useState<boolean>(false);
  const [updateQuotePrice, setUpdateQuotePrice] = useState<string>('');
  const [updateQuotePriceError, setUpdateQuotePriceError] = useState<string | null>(null);
  const [updatingQuote, setUpdatingQuote] = useState<boolean>(false);
  
  // Quote request state (for owners)
  const [sendingQuoteRequest, setSendingQuoteRequest] = useState<boolean>(false);
  const [quoteRequestError, setQuoteRequestError] = useState<string | null>(null);
  const [quoteRequestSuccess, setQuoteRequestSuccess] = useState<string | null>(null);

  // Handle quote submission
  const handleSubmitQuote = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Reset errors and success
    setQuoteEmailError(null);
    setQuotePriceError(null);
    setQuoteSuccess(false);

    // Basic email format validation (accept personal emails like Gmail)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(quoteEmail.trim())) {
      setQuoteEmailError('Please enter a valid email address');
      return;
    }

    // Validate price - parse the formatted price (remove commas)
    const priceNum = parseFloat(parsePriceInput(quotePrice));
    if (isNaN(priceNum) || priceNum <= 0) {
      setQuotePriceError('Please enter a valid price greater than 0');
      return;
    }

    setSubmittingQuote(true);

    try {
      const response = await fetch('/api/submit-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: tripId,
          email: quoteEmail.trim(),
          driverName: quoteDriverName.trim() || null,
          price: priceNum,
          currency: quoteCurrency,
        }),
      });

      const result = await response.json();

      if (result.success) {
        const action = result.isUpdate ? 'updated' : 'submitted';
        console.log(`✅ Quote ${action} successfully`);
        const submittedEmail = quoteEmail.trim();
        setQuoteSuccessMessage(
          result.isUpdate
            ? 'Quote updated successfully! The trip owner will see your updated offer.'
            : 'Quote submitted successfully! The trip owner will review your offer.'
        );
        setQuoteSuccess(true);

        // Fetch the driver's quotes to show their submission
        await fetchMyQuotes(submittedEmail);

        // Clear form fields but keep email for future quotes
        setQuotePrice('');
        setQuoteCurrency('USD');

        // Hide success message after 5 seconds
        setTimeout(() => setQuoteSuccess(false), 5000);
      } else {
        setQuoteEmailError(result.error || 'Failed to submit quote');
      }
    } catch (err) {
      console.error('❌ Error submitting quote:', err);
      setQuoteEmailError('Failed to submit quote. Please try again.');
    } finally {
      setSubmittingQuote(false);
    }
  }, [tripId, quoteEmail, quotePrice, quoteDriverName, quoteCurrency, fetchMyQuotes]);

  // Handle opening update quote modal
  const handleOpenUpdateQuote = useCallback(() => {
    // Check if driver is assigned - prevent updates if assigned
    if (driverEmail) {
      setQuoteEmailError('Quote cannot be updated - driver already assigned');
      return;
    }

    const latestQuote = myQuotes[0];
    if (latestQuote) {
      setUpdateQuotePrice('');
      setUpdateQuotePriceError(null);
      setShowUpdateQuoteModal(true);
    }
  }, [driverEmail, myQuotes]);

  // Handle updating quote
  const handleUpdateQuote = useCallback(async () => {
    // Check if driver is assigned - prevent updates if assigned
    if (driverEmail) {
      setUpdateQuotePriceError('Quote cannot be updated - driver already assigned');
      return;
    }

    setUpdateQuotePriceError(null);

    // Validate price
    const priceNum = parseFloat(updateQuotePrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setUpdateQuotePriceError('Please enter a valid price greater than 0');
      return;
    }

    const latestQuote = myQuotes[0];
    if (!latestQuote) {
      setUpdateQuotePriceError('No existing quote found');
      return;
    }

    setUpdatingQuote(true);

    try {
      const response = await fetch('/api/submit-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: tripId,
          email: quoteEmail.trim() || latestQuote.email,
          price: priceNum,
          currency: latestQuote.currency, // Lock to original currency
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Quote updated successfully');
        setShowUpdateQuoteModal(false);
        setUpdateQuotePrice('');
        setQuoteSuccessMessage('Quote updated successfully! The trip owner will see your updated offer.');
        setQuoteSuccess(true);

        // Refresh driver's quotes to show the new latest quote
        await fetchMyQuotes(quoteEmail.trim() || latestQuote.email);

        // Hide success message after 5 seconds
        setTimeout(() => setQuoteSuccess(false), 5000);
      } else {
        setUpdateQuotePriceError(result.error || 'Failed to update quote');
      }
    } catch (error) {
      setUpdateQuotePriceError('Failed to update quote. Please try again.');
    } finally {
      setUpdatingQuote(false);
    }
  }, [tripId, driverEmail, updateQuotePrice, myQuotes, quoteEmail, fetchMyQuotes]);

  // Handle sending quote request (owner inviting drivers)
  const handleSendQuoteRequest = useCallback(async (emailToUse?: string) => {
    const driverEmailToUse = emailToUse || allocateDriverEmail;
    if (!tripId || !isOwner || !driverEmailToUse || sendingQuoteRequest) return;

    // Reset errors and success
    setQuoteRequestError(null);
    setQuoteRequestSuccess(null);
    // Note: allocateDriverEmailError and manualDriverError are managed by parent component

    // Basic email format validation (accept personal emails like Gmail)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(driverEmailToUse.trim())) {
      setQuoteRequestError('Please enter a valid email address');
      return;
    }

    // Check if already sent to this email
    const normalizedEmail = driverEmailToUse.trim().toLowerCase();
    if (sentDriverEmails.some(sent => sent.email.toLowerCase() === normalizedEmail)) {
      setQuoteRequestError('Quote request already sent to this email');
      return;
    }

    setSendingQuoteRequest(true);

    try {
      // Get the current session to send auth token
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setQuoteRequestError('You must be logged in to send quote requests');
        setSendingQuoteRequest(false);
        return;
      }

      const response = await fetch('/api/request-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          tripId: tripId,
          driverEmail: driverEmailToUse.trim(),
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Add to sent emails list
        onSentDriverEmailsSet([
          ...sentDriverEmails,
          {
            email: driverEmailToUse.trim(),
            sentAt: new Date().toISOString(),
          }
        ]);

        setQuoteRequestSuccess(`Quote request sent to ${driverEmailToUse.trim()}`);
        // Clear form
        onManualDriverEmailSet('');
        onAllocateDriverEmailSet('');
        // Hide success message after 5 seconds
        setTimeout(() => setQuoteRequestSuccess(null), 5000);
      } else {
        setQuoteRequestError(result.error || 'Failed to send quote request');
      }
    } catch (err) {
      console.error('❌ Error sending quote request:', err);
      setQuoteRequestError('Failed to send quote request. Please try again.');
    } finally {
      setSendingQuoteRequest(false);
    }
  }, [tripId, isOwner, allocateDriverEmail, sendingQuoteRequest, sentDriverEmails, onSentDriverEmailsSet, onManualDriverEmailSet, onAllocateDriverEmailSet]);

  return {
    // Quote form state
    quoteDriverName,
    quotePrice,
    quoteCurrency,
    quoteEmailError,
    quotePriceError,
    submittingQuote,
    quoteSuccess,
    quoteSuccessMessage,
    setQuoteDriverName,
    setQuotePrice,
    setQuoteCurrency,
    setQuoteEmailError,
    setQuotePriceError,
    setQuoteSuccess,
    setQuoteSuccessMessage,
    
    // Quote update state
    showUpdateQuoteModal,
    updateQuotePrice,
    updateQuotePriceError,
    updatingQuote,
    setShowUpdateQuoteModal,
    setUpdateQuotePrice,
    setUpdateQuotePriceError,
    
    // Quote request state
    sendingQuoteRequest,
    quoteRequestError,
    quoteRequestSuccess,
    setQuoteRequestError,
    setQuoteRequestSuccess,
    
    // Handlers
    handleSubmitQuote,
    handleOpenUpdateQuote,
    handleUpdateQuote,
    handleSendQuoteRequest,
  };
}

