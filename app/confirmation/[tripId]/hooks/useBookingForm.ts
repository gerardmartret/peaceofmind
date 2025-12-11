import { useState } from 'react';
import { bookingPreviewInitialState, type BookingPreviewFieldKey } from '@/app/results/[id]/constants';
import { validatePhoneNumber } from '../utils/phoneValidation';

interface UseBookingFormOptions {
  initialFields?: typeof bookingPreviewInitialState;
}

export function useBookingForm(options?: UseBookingFormOptions) {
  const [bookingPreviewFields, setBookingPreviewFields] = useState(
    options?.initialFields || bookingPreviewInitialState
  );
  const [missingFields, setMissingFields] = useState<Set<BookingPreviewFieldKey>>(new Set());
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [leadPassengerEmailError, setLeadPassengerEmailError] = useState<string | null>(null);

  // Handle booking field changes
  const handleBookingFieldChange = (field: BookingPreviewFieldKey, value: string | number) => {
    setBookingPreviewFields(prev => ({
      ...prev,
      [field]: value,
    }));
    
    // Clear errors when user types
    if (field === 'contactPhone') {
      setPhoneError(null);
    }
    if (field === 'leadPassengerEmail') {
      setLeadPassengerEmailError(null);
    }
    
    if (missingFields.has(field)) {
      setMissingFields((prev) => {
        const next = new Set(prev);
        next.delete(field);
        return next;
      });
    }
  };

  // Validate phone number
  const validatePhone = (phone: string): string | null => {
    return validatePhoneNumber(phone);
  };

  // Validate lead passenger email
  const validateLeadPassengerEmail = (email: string): string | null => {
    if (!email || !email.trim()) {
      return 'Lead passenger email is required';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return 'Please enter a valid email address';
    }
    return null;
  };

  // Get phone field className based on error state
  const getPhoneFieldClassName = () => {
    const baseClass = 'mt-2 w-full border border-border rounded-md px-3 py-2';
    if (phoneError) {
      return `${baseClass} border-destructive/70 bg-destructive/10 text-destructive`;
    }
    return baseClass;
  };

  // Highlight missing fields
  const highlightMissing = (field: BookingPreviewFieldKey) =>
    missingFields.has(field) ? 'border-destructive/70 bg-destructive/10 text-destructive' : '';

  return {
    bookingPreviewFields,
    setBookingPreviewFields,
    missingFields,
    setMissingFields,
    phoneError,
    setPhoneError,
    leadPassengerEmailError,
    setLeadPassengerEmailError,
    handleBookingFieldChange,
    validatePhone,
    validateLeadPassengerEmail,
    getPhoneFieldClassName,
    highlightMissing,
  };
}
