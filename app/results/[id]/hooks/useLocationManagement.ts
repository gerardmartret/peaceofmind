/**
 * useLocationManagement Hook
 * 
 * Handles location management operations:
 * - Location name editing and saving
 * - Location display name state management
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { TripData } from '../types';

export interface UseLocationManagementParams {
  tripId: string | undefined;
  isOwner: boolean;
  tripData: TripData | null;
  driverNotes: string;
  editedDriverNotes: string;
  onTripDataUpdate: (tripData: TripData) => void;
  onLocationDisplayNamesUpdate: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
}

export interface UseLocationManagementReturn {
  editingLocationId: string | null;
  editingLocationName: string;
  setEditingLocationId: (id: string | null) => void;
  setEditingLocationName: (name: string) => void;
  handleSaveLocationName: (locationId: string) => Promise<void>;
}

/**
 * Hook for location management (name editing, saving)
 */
export function useLocationManagement({
  tripId,
  isOwner,
  tripData,
  driverNotes,
  editedDriverNotes,
  onTripDataUpdate,
  onLocationDisplayNamesUpdate,
}: UseLocationManagementParams): UseLocationManagementReturn {
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editingLocationName, setEditingLocationName] = useState<string>('');

  const handleSaveLocationName = useCallback(async (locationId: string) => {
    // Security check: Only owners can edit location names
    if (!isOwner) {
      setEditingLocationId(null);
      setEditingLocationName('');
      return;
    }

    if (!tripId || !editingLocationName.trim() || !tripData) {
      setEditingLocationId(null);
      setEditingLocationName('');
      return;
    }

    try {
      // Update the locations array with the new display name
      const updatedLocations = tripData.locations.map(loc =>
        loc.id === locationId
          ? { ...loc, displayName: editingLocationName.trim() }
          : loc
      );

      // Save to database - preserve trip_notes if they've been edited
      const updateData: any = { locations: updatedLocations };
      // Preserve current edited trip notes if they exist (user may have edited but not saved yet)
      // Always preserve editedDriverNotes if it's different from the original driverNotes
      // This handles cases where user edits notes but hasn't clicked "Save" on the notes field yet
      if (editedDriverNotes !== undefined && editedDriverNotes !== driverNotes) {
        updateData.trip_notes = editedDriverNotes || null; // Allow empty string to be saved
      } else if (driverNotes !== undefined) {
        // If no edits, preserve the current driverNotes to prevent accidental loss
        updateData.trip_notes = driverNotes || null;
      }

      const { error: updateError } = await supabase
        .from('trips')
        .update(updateData)
        .eq('id', tripId);

      if (updateError) {
        setEditingLocationId(null);
        setEditingLocationName('');
        return;
      }

      // Update local state
      onTripDataUpdate({
        ...tripData,
        locations: updatedLocations
      });

      onLocationDisplayNamesUpdate(prev => ({
        ...prev,
        [locationId]: editingLocationName.trim()
      }));

      setEditingLocationId(null);
      setEditingLocationName('');
    } catch (error) {
      setEditingLocationId(null);
      setEditingLocationName('');
    }
  }, [
    tripId,
    isOwner,
    tripData,
    driverNotes,
    editedDriverNotes,
    editingLocationName,
    onTripDataUpdate,
    onLocationDisplayNamesUpdate,
  ]);

  return {
    editingLocationId,
    editingLocationName,
    setEditingLocationId,
    setEditingLocationName,
    handleSaveLocationName,
  };
}

