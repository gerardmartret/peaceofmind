/**
 * useTripActions Hook
 * 
 * Handles trip-related API actions:
 * - Fetching driver suggestions
 * - Setting driver for trip
 * - Updating trip status
 * - Sending status change notifications
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { safeJsonParse } from '@/lib/helpers/api-helpers';

export interface UseTripActionsParams {
  tripId: string | undefined;
  isOwner: boolean;
  loading: boolean;
  userId: string | undefined;
  tripStatus: string;
  driverEmail: string | null;
  pendingStatus: string | null;
  assignOnlyMode: boolean;
  onStatusUpdate: (status: string) => void;
  onDriverUpdate: (email: string | null) => void;
  onPendingStatusClear: () => void;
  onStatusModalClose: () => void;
  onDriverModalClose: () => void;
  onAssignOnlyModeChange: (value: boolean) => void;
}

export interface UseTripActionsReturn {
  // Driver suggestions
  driverSuggestions: string[];
  filteredDriverSuggestions: string[];
  showDriverSuggestions: boolean;
  setDriverSuggestions: (drivers: string[]) => void;
  setFilteredDriverSuggestions: (drivers: string[]) => void;
  setShowDriverSuggestions: (show: boolean) => void;
  
  // Driver management
  settingDriver: boolean;
  manualDriverEmail: string;
  manualDriverError: string | null;
  setManualDriverEmail: (email: string) => void;
  setManualDriverError: (error: string | null) => void;
  handleSetDriver: (email: string) => Promise<void>;
  handleManualDriverInputChange: (value: string) => void;
  handleManualDriverInputFocus: () => void;
  handleSelectDriverSuggestion: (driver: string) => void;
  
  // Status management
  updatingStatus: boolean;
  sendingStatusNotification: boolean;
  handleConfirmStatusChange: (notifyDriver?: boolean) => Promise<void>;
  sendStatusChangeNotification: () => Promise<void>;
}

/**
 * Hook for trip-related actions (driver management, status updates)
 */
export function useTripActions({
  tripId,
  isOwner,
  loading,
  userId,
  tripStatus,
  driverEmail,
  pendingStatus,
  assignOnlyMode,
  onStatusUpdate,
  onDriverUpdate,
  onPendingStatusClear,
  onStatusModalClose,
  onDriverModalClose,
  onAssignOnlyModeChange,
}: UseTripActionsParams): UseTripActionsReturn {
  // Driver suggestions state
  const [driverSuggestions, setDriverSuggestions] = useState<string[]>([]);
  const [filteredDriverSuggestions, setFilteredDriverSuggestions] = useState<string[]>([]);
  const [showDriverSuggestions, setShowDriverSuggestions] = useState<boolean>(false);
  
  // Driver management state
  const [settingDriver, setSettingDriver] = useState(false);
  const [manualDriverEmail, setManualDriverEmail] = useState('');
  const [manualDriverError, setManualDriverError] = useState<string | null>(null);
  
  // Status management state
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [sendingStatusNotification, setSendingStatusNotification] = useState(false);

  // Fetch driver suggestions when page loads (for owners only)
  useEffect(() => {
    async function fetchDriverSuggestions() {
      if (!isOwner || !userId) return;

      try {
        const response = await fetch('/api/get-user-drivers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: userId,
          }),
        });

        // Handle non-JSON responses
        if (!response.ok) {
          console.error('❌ Failed to fetch driver suggestions:', response.statusText);
          return;
        }

        const result = await response.json();

        if (result.success) {
          setDriverSuggestions(result.drivers || []);
          setFilteredDriverSuggestions(result.drivers || []);
          console.log(`✅ Loaded ${result.drivers?.length || 0} driver suggestions`);
        } else {
          console.error('❌ Failed to fetch driver suggestions:', result.error);
        }
      } catch (err) {
        console.error('❌ Error fetching driver suggestions:', err);
      }
    }

    if (isOwner && !loading && userId) {
      fetchDriverSuggestions();
    }
  }, [isOwner, loading, userId]);

  // Send status change notification
  const sendStatusChangeNotification = useCallback(async () => {
    if (!tripId || !driverEmail || !pendingStatus) return;

    setSendingStatusNotification(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.error('❌ No session found');
        return;
      }

      const response = await fetch('/api/notify-status-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          tripId: tripId,
          newStatus: pendingStatus,
        }),
      });

      const result = await safeJsonParse(response);

      if (result.success) {
        console.log(`✅ Status change notification sent to driver`);
      } else {
        console.error('❌ Failed to send status notification:', result.error);
      }
    } catch (err) {
      console.error('❌ Error sending status notification:', err);
    } finally {
      setSendingStatusNotification(false);
    }
  }, [tripId, driverEmail, pendingStatus]);

  // Confirm status change
  const handleConfirmStatusChange = useCallback(async (notifyDriver: boolean = false) => {
    if (!tripId || !isOwner || !pendingStatus) return;

    setUpdatingStatus(true);

    try {
      // If changing from confirmed to not confirmed AND notifying driver, send notification FIRST
      if (tripStatus === 'confirmed' && pendingStatus === 'not confirmed' && notifyDriver && driverEmail) {
        console.log('📧 Sending notification before clearing driver...');
        await sendStatusChangeNotification();
      }

      // Now update the status (this will clear the driver if going from confirmed to not confirmed)
      const response = await fetch('/api/update-trip-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: tripId,
          status: pendingStatus,
        }),
      });

      const result = await safeJsonParse(response);

      if (result.success) {
        const oldStatus = tripStatus;
        onStatusUpdate(pendingStatus);
        console.log(`✅ Trip status updated to: ${pendingStatus}`);

        // If changing from confirmed to not confirmed, clear driver in UI
        if (oldStatus === 'confirmed' && pendingStatus === 'not confirmed') {
          onDriverUpdate(null);
          console.log(`✅ Driver assignment cleared in UI`);
        }

        // Send notification for other cases (confirmed -> confirmed, not confirmed -> confirmed)
        if (notifyDriver && driverEmail && !(oldStatus === 'confirmed' && pendingStatus === 'not confirmed')) {
          await sendStatusChangeNotification();
        }

        // Close modal
        onStatusModalClose();
        onPendingStatusClear();
      } else {
        console.error('❌ Failed to update status:', result.error);
      }
    } catch (err) {
      console.error('❌ Error updating trip status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  }, [tripId, isOwner, pendingStatus, tripStatus, driverEmail, sendStatusChangeNotification, onStatusUpdate, onDriverUpdate, onStatusModalClose, onPendingStatusClear]);

  // Set driver for trip
  const handleSetDriver = useCallback(async (email: string) => {
    if (!tripId || !isOwner || settingDriver) return;

    setSettingDriver(true);
    setManualDriverError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.error('❌ No session found');
        setManualDriverError('Please log in to set driver');
        setSettingDriver(false);
        return;
      }

      const response = await fetch('/api/set-driver', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          tripId: tripId,
          driverEmail: email,
        }),
      });

      const result = await safeJsonParse(response);

      if (result.success) {
        onDriverUpdate(email.toLowerCase());
        console.log(`✅ Driver set successfully`);
        setManualDriverEmail('');
        setShowDriverSuggestions(false);
        
        // If in assign-only mode, close modal (don't auto-confirm, let user manually confirm)
        if (assignOnlyMode) {
          console.log('🚗 [ASSIGN-ONLY] Driver assigned, closing modal. Trip status is now Pending.');
          onDriverModalClose();
          onAssignOnlyModeChange(false);
          // User can now click the "Pending" button to manually confirm
        }
      } else {
        setManualDriverError(result.error || 'Failed to set driver');
      }
    } catch (err) {
      console.error('❌ Error setting driver:', err);
      setManualDriverError('An error occurred while setting driver');
    } finally {
      setSettingDriver(false);
    }
  }, [tripId, isOwner, settingDriver, assignOnlyMode, onDriverUpdate, onDriverModalClose, onAssignOnlyModeChange]);

  // Manual driver input handlers
  const handleManualDriverInputChange = useCallback((value: string) => {
    setManualDriverEmail(value);
    setManualDriverError(null);

    // Filter suggestions based on input
    if (value.trim().length > 0) {
      const filtered = driverSuggestions.filter(driver =>
        driver.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredDriverSuggestions(filtered);
    } else {
      setFilteredDriverSuggestions(driverSuggestions);
    }
  }, [driverSuggestions]);

  const handleManualDriverInputFocus = useCallback(() => {
    setShowDriverSuggestions(true);
    if (manualDriverEmail.trim().length === 0) {
      setFilteredDriverSuggestions(driverSuggestions);
    }
  }, [manualDriverEmail, driverSuggestions]);

  const handleSelectDriverSuggestion = useCallback((driver: string) => {
    setManualDriverEmail(driver);
    setShowDriverSuggestions(false);
  }, []);

  return {
    // Driver suggestions
    driverSuggestions,
    filteredDriverSuggestions,
    showDriverSuggestions,
    setDriverSuggestions,
    setFilteredDriverSuggestions,
    setShowDriverSuggestions,
    
    // Driver management
    settingDriver,
    manualDriverEmail,
    manualDriverError,
    setManualDriverEmail,
    setManualDriverError,
    handleSetDriver,
    handleManualDriverInputChange,
    handleManualDriverInputFocus,
    handleSelectDriverSuggestion,
    
    // Status management
    updatingStatus,
    sendingStatusNotification,
    handleConfirmStatusChange,
    sendStatusChangeNotification,
  };
}

