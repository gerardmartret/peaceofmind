/**
 * useNotifications Hook
 * 
 * Handles notification operations:
 * - Notifying driver about trip
 * - Handling update notification responses
 * - Related state management
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { safeJsonParse } from '@/lib/helpers/api-helpers';

export interface UseNotificationsParams {
  tripId: string | undefined;
  isOwner: boolean;
  driverEmail: string | null;
}

export interface UseNotificationsReturn {
  notifyingDriver: boolean;
  notificationSuccess: boolean;
  notificationError: string | null;
  sendingUpdateNotification: boolean;
  showUpdateNotificationModal: boolean;
  setNotificationSuccess: (success: boolean) => void;
  setNotificationError: (error: string | null) => void;
  setSendingUpdateNotification: (sending: boolean) => void;
  setShowUpdateNotificationModal: (show: boolean) => void;
  handleNotifyDriver: () => Promise<void>;
  handleUpdateNotificationResponse: (notify: boolean) => Promise<void>;
}

/**
 * Hook for notification operations
 */
export function useNotifications({
  tripId,
  isOwner,
  driverEmail,
}: UseNotificationsParams): UseNotificationsReturn {
  const [notifyingDriver, setNotifyingDriver] = useState<boolean>(false);
  const [notificationSuccess, setNotificationSuccess] = useState<boolean>(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [sendingUpdateNotification, setSendingUpdateNotification] = useState<boolean>(false);
  const [showUpdateNotificationModal, setShowUpdateNotificationModal] = useState<boolean>(false);

  const handleNotifyDriver = useCallback(async () => {
    if (!tripId || !isOwner || !driverEmail || notifyingDriver) return;

    setNotifyingDriver(true);
    setNotificationError(null);
    setNotificationSuccess(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setNotificationError('Please log in to notify driver');
        setNotifyingDriver(false);
        return;
      }

      const response = await fetch('/api/notify-driver', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          tripId: tripId,
        }),
      });

      const result = await safeJsonParse(response);

      if (result.success) {
        setNotificationSuccess(true);
        // Hide success message after 5 seconds
        setTimeout(() => setNotificationSuccess(false), 5000);
      } else {
        setNotificationError(result.error || 'Failed to notify driver');
      }
    } catch (err) {
      setNotificationError('An error occurred while notifying driver');
    } finally {
      setNotifyingDriver(false);
    }
  }, [tripId, isOwner, driverEmail, notifyingDriver]);

  const handleUpdateNotificationResponse = useCallback(async (notify: boolean) => {
    if (notify && driverEmail) {
      setSendingUpdateNotification(true);

      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          window.location.reload();
          return;
        }

        const response = await fetch('/api/notify-driver', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            tripId: tripId,
          }),
        });

        const result = await response.json();

        if (result.success) {
        } else {
        }
      } catch (err) {
      } finally {
        setSendingUpdateNotification(false);
        // Always reload after attempting notification
        window.location.reload();
      }
    } else {
      // User chose not to notify, just reload
      window.location.reload();
    }
  }, [tripId, driverEmail]);

  return {
    notifyingDriver,
    notificationSuccess,
    notificationError,
    sendingUpdateNotification,
    showUpdateNotificationModal,
    setNotificationSuccess,
    setNotificationError,
    setSendingUpdateNotification,
    setShowUpdateNotificationModal,
    handleNotifyDriver,
    handleUpdateNotificationResponse,
  };
}

