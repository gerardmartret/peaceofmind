import { useCallback } from 'react';
import { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

export interface EditingLocation {
  location: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  time: string;
  purpose?: string;
  confidence?: string;
  verified?: boolean;
  placeId?: string;
}

interface UseRouteEditingParams {
  editingLocations: EditingLocation[];
  setEditingLocations: (locations: EditingLocation[] | ((prev: EditingLocation[]) => EditingLocation[])) => void;
}

export const useRouteEditing = (params: UseRouteEditingParams) => {
  const { editingLocations, setEditingLocations } = params;

  const handleEditRouteDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setEditingLocations((items) => {
        const oldIndex = items.findIndex((item) => (item.placeId || `fallback-${items.indexOf(item)}`) === active.id);
        const newIndex = items.findIndex((item) => (item.placeId || `fallback-${items.indexOf(item)}`) === over.id);

        // Store the times in their current positions before reordering
        const timesByPosition = items.map(item => item.time);

        // Reorder the locations
        const reorderedItems = arrayMove(items, oldIndex, newIndex);

        // Reassign times based on new positions (times stay with positions, not locations)
        const itemsWithSwappedTimes = reorderedItems.map((item, index) => ({
          ...item,
          time: timesByPosition[index]
        }));

        console.log(`🔄 Edit route: Location reordered ${oldIndex + 1} → ${newIndex + 1}`);
        console.log(`   Time swapped: ${items[oldIndex].time} ↔ ${items[newIndex].time}`);

        return itemsWithSwappedTimes;
      });
    }
  }, [setEditingLocations]);

  const handleEditLocationSelect = useCallback((index: number, location: any) => {
    setEditingLocations((items) => {
      const updatedLocations = [...items];
      updatedLocations[index] = {
        ...updatedLocations[index],
        location: location.name,
        formattedAddress: location.name,
        lat: location.lat,
        lng: location.lng,
        verified: true,
        // Keep purpose unchanged
      };
      console.log(`✅ Location updated at index ${index}:`, location.name);
      console.log(`   Purpose preserved: ${updatedLocations[index].purpose}`);
      return updatedLocations;
    });
  }, [setEditingLocations]);

  const handleEditTimeChange = useCallback((index: number, time: string) => {
    setEditingLocations((items) => {
      const updatedLocations = [...items];
      updatedLocations[index] = {
        ...updatedLocations[index],
        time: time,
      };
      return updatedLocations;
    });
  }, [setEditingLocations]);

  const handleEditLocationRemove = useCallback((index: number) => {
    setEditingLocations((items) => {
      if (items.length > 1) {
        return items.filter((_, idx) => idx !== index);
      }
      return items;
    });
  }, [setEditingLocations]);

  const handleAddEditLocation = useCallback(() => {
    setEditingLocations((items) => {
      const newIndex = items.length;
      const newLocation: EditingLocation = {
        location: '',
        formattedAddress: '',
        lat: 0,
        lng: 0,
        time: '12:00',
        purpose: `Location ${newIndex + 1}`, // Default purpose for new locations
        confidence: 'low',
        verified: false,
        placeId: `new-location-${Date.now()}-${Math.random()}`,
      };
      return [...items, newLocation];
    });
  }, [setEditingLocations]);

  return {
    handleEditRouteDragEnd,
    handleEditLocationSelect,
    handleEditTimeChange,
    handleEditLocationRemove,
    handleAddEditLocation,
  };
};

