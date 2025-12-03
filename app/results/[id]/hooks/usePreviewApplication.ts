/**
 * usePreviewApplication Hook
 * 
 * Handles applying preview changes to the trip.
 * Validates locations and applies non-location field changes.
 */

import { isAirportLocation } from '../utils/location-helpers';

interface UsePreviewApplicationParams {
  previewLocations: any[];
  previewDriverNotes: string;
  previewNonLocationFields: {
    leadPassengerName?: string;
    vehicleInfo?: string;
    passengerCount?: number;
    tripDestination?: string;
  };
  tripData: any;
  driverNotes: string;
  setEditingLocations: (locations: any[]) => void;
  setEditedDriverNotes: (notes: string) => void;
  setDriverNotes: (notes: string) => void;
  setLeadPassengerName: (name: string) => void;
  setVehicleInfo: (info: string) => void;
  setPassengerCount: (count: number) => void;
  setTripDestination: (destination: string) => void;
  setShowPreviewModal: (show: boolean) => void;
  handleSaveRouteEdits: (locations?: any[]) => Promise<void>;
}

export const usePreviewApplication = (params: UsePreviewApplicationParams) => {
  const {
    previewLocations,
    previewDriverNotes,
    previewNonLocationFields,
    tripData,
    driverNotes,
    setEditingLocations,
    setEditedDriverNotes,
    setDriverNotes,
    setLeadPassengerName,
    setVehicleInfo,
    setPassengerCount,
    setTripDestination,
    setShowPreviewModal,
    handleSaveRouteEdits,
  } = params;

  const handleApplyPreview = async () => {
    console.log('✅ [PREVIEW] Applying changes...');

    // Prepare validated locations to pass directly (avoiding React state timing issues)
    // Check all possible location fields: location, formattedAddress, or purpose
    const validatedLocations = previewLocations.filter(loc => {
      const hasCoords = loc.lat !== 0 && loc.lng !== 0;
      const hasName = (loc.location && loc.location.trim() !== '') ||
        (loc.formattedAddress && loc.formattedAddress.trim() !== '') ||
        (loc.purpose && loc.purpose.trim() !== '');
      // Exception: Airport locations are valid even without coordinates if they match airport pattern
      const isAirport = isAirportLocation(loc.location) || 
                       isAirportLocation(loc.formattedAddress) || 
                       isAirportLocation(loc.purpose);
      return (hasCoords && hasName) || (isAirport && hasName);
    });

    // Fallback: If previewLocations is empty/invalid and we have tripData, use original locations
    // This handles cases where only non-location fields (passenger, vehicle) were changed
    let locationsToSave = validatedLocations;
    if (locationsToSave.length === 0 && tripData?.locations && tripData.locations.length > 0) {
      console.log('⚠️ [PREVIEW] No valid preview locations, falling back to tripData.locations');
      // Convert tripData.locations to manual form format (same as mapExtractedToManualForm does)
      locationsToSave = tripData.locations.map((loc: any, idx: number) => ({
        location: loc.name || (loc as any).fullAddress || '',
        formattedAddress: (loc as any).fullAddress || (loc as any).formattedAddress || '', // Never fall back to name (purpose)
        lat: loc.lat || 0,
        lng: loc.lng || 0,
        time: loc.time || '12:00',
        purpose: loc.name || '', // Purpose is always from name, never fall back to fullAddress
        confidence: 'high' as 'high' | 'medium' | 'low',
        verified: true,
        placeId: loc.id || `location-${idx + 1}`,
      }));
    }

    // Final validation
    const finalValidLocations = locationsToSave.filter(loc => {
      const hasCoords = loc.lat !== 0 && loc.lng !== 0;
      const hasName = (loc.location && loc.location.trim() !== '') ||
        (loc.formattedAddress && loc.formattedAddress.trim() !== '') ||
        (loc.purpose && loc.purpose.trim() !== '');
      // Exception: Airport locations are valid even without coordinates if they match airport pattern
      const isAirport = isAirportLocation(loc.location) || 
                       isAirportLocation(loc.formattedAddress) || 
                       isAirportLocation(loc.purpose);
      return (hasCoords && hasName) || (isAirport && hasName);
    });

    if (finalValidLocations.length === 0) {
      alert('Please ensure all locations have valid addresses and coordinates. Some locations may need to be selected from the address dropdown.');
      return;
    }

    // Set editingLocations with validated data (for UI consistency, even though we pass directly)
    setEditingLocations(finalValidLocations);

    // Update driver notes if changed
    if (previewDriverNotes !== driverNotes) {
      setEditedDriverNotes(previewDriverNotes);
      setDriverNotes(previewDriverNotes);
    }
    // Apply non-location field changes
    if (previewNonLocationFields.leadPassengerName) {
      setLeadPassengerName(previewNonLocationFields.leadPassengerName);
    }
    if (previewNonLocationFields.vehicleInfo) {
      setVehicleInfo(previewNonLocationFields.vehicleInfo);
    }
    if (previewNonLocationFields.passengerCount) {
      setPassengerCount(previewNonLocationFields.passengerCount);
    }
    if (previewNonLocationFields.tripDestination) {
      setTripDestination(previewNonLocationFields.tripDestination);
    }
    // Close preview modal
    setShowPreviewModal(false);
    // Pass validated locations directly to avoid React state timing issues
    await handleSaveRouteEdits(finalValidLocations);
  };

  return {
    handleApplyPreview,
  };
};

