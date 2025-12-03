/**
 * useTripRegeneration Hook
 * 
 * Handles trip regeneration after updates are extracted.
 * Validates locations, geocodes as needed, and triggers trip analysis update.
 */

import { needsGeocoding, geocodeLocations } from '../utils/geocoding-helpers';
import { validateLocationCoordinates, detectCoordinateMismatches, regeocodeInconsistentLocations } from '../utils/validation-helpers';

interface UseTripRegenerationParams {
  tripData: any;
  tripDestination: string;
  driverNotes: string;
  leadPassengerName: string;
  vehicleInfo: string;
  passengerCount: number;
  setError: (error: string | null) => void;
  setIsRegenerating: (regenerating: boolean) => void;
  setRegenerationStep: (step: string) => void;
  setRegenerationProgress: (progress: number) => void;
  setRegenerationSteps: (steps: any[] | ((prev: any[]) => any[])) => void;
  performTripAnalysisUpdate: (
    validLocations: Array<{ id: string; name: string; lat: number; lng: number; time: string; fullAddress?: string; purpose?: string }>,
    tripDateObj: Date,
    leadPassengerName?: string,
    vehicleInfo?: string,
    passengerCount?: number,
    tripDestination?: string,
    passengerNames?: string[],
    driverNotes?: string,
    latestChanges?: any
  ) => Promise<void>;
}

export const useTripRegeneration = (params: UseTripRegenerationParams) => {
  const {
    tripData,
    tripDestination,
    driverNotes,
    leadPassengerName,
    vehicleInfo,
    passengerCount,
    setError,
    setIsRegenerating,
    setRegenerationStep,
    setRegenerationProgress,
    setRegenerationSteps,
    performTripAnalysisUpdate,
  } = params;

  const handleRegenerateDirectly = async (comparisonDiff: any, extractedUpdates: any) => {
    if (!comparisonDiff || !extractedUpdates || !tripData) {
      console.error('❌ Missing required data for regeneration');
      setError('Missing required data for regeneration');
      setIsRegenerating(false);
      return;
    }

    setError(null);
    setRegenerationStep('Preparing updated locations...');

    try {
      // Use finalLocations from AI comparison (already merged intelligently)
      const finalLocations = comparisonDiff.finalLocations || [];

      // Convert final locations to format expected by performTripAnalysis
      // Log for debugging
      console.log('🔍 [DEBUG] Final locations before validation:', JSON.stringify(finalLocations, null, 2));

      // Filter out locations with invalid coordinates (lat === 0 && lng === 0)
      console.log(`🔍 [VALIDATION-DIAG] Starting validation with ${finalLocations.length} locations`);
      const validLocations = finalLocations
        .map((loc: any, idx: number) => {
          const location = {
            id: loc.id || (idx + 1).toString(),
            name: loc.name || loc.purpose || loc.fullAddress || loc.address || '',
            lat: loc.lat || 0,
            lng: loc.lng || 0,
            time: loc.time || '',
            fullAddress: loc.fullAddress || loc.address || loc.name || '',
            purpose: loc.purpose || loc.name || '',
          };

          // Log locations with invalid coordinates
          if (location.lat === 0 && location.lng === 0) {
            console.warn(`⚠️ [VALIDATION-DIAG] Location ${idx + 1} (${location.name}) has invalid coordinates (0, 0)`);
            console.warn(`   - fullAddress: "${location.fullAddress}"`);
            console.warn(`   - Original loc data:`, JSON.stringify(loc, null, 2));
          }

          return location;
        })
        .filter((loc: any) => {
          const isValid = validateLocationCoordinates(loc);
          if (!isValid) {
            console.warn(`⚠️ [VALIDATION-DIAG] Filtering out location "${loc.name}" due to invalid coordinates`);
            console.warn(`   - This location will be removed from the trip`);
          }
          return isValid;
        });

      console.log(`✅ [DEBUG] Valid locations after filtering: ${validLocations.length}`);
      validLocations.forEach((loc: any, idx: number) => {
        console.log(`   ${idx + 1}. ${loc.name} - (${loc.lat}, ${loc.lng})`);
      });

      // Validate that we have at least 2 valid locations for traffic predictions
      if (validLocations.length < 2) {
        console.error('❌ Need at least 2 locations with valid coordinates for traffic predictions');
        console.error(`   Current valid locations: ${validLocations.length}`);
        console.error(`   Total final locations: ${finalLocations.length}`);
        setError('Need at least 2 locations with valid coordinates to calculate routes. Please ensure all locations have valid addresses.');
        setIsRegenerating(false);
        return;
      }

      // VALIDATION: Check for coordinate/address mismatches BEFORE geocoding decision
      console.log('🔍 [VALIDATION] Checking coordinate/address consistency...');
      const inconsistentLocations = detectCoordinateMismatches(validLocations, tripDestination);

      // Re-geocode inconsistent locations
      await regeocodeInconsistentLocations(inconsistentLocations, validLocations, tripDestination);

      // OPTIMIZATION: Separate locations that need geocoding from those that don't
      const locationsNeedingGeocoding = validLocations.filter(needsGeocoding);
      const locationsWithValidData = validLocations.filter((loc: any) => !needsGeocoding(loc));

      console.log(`🗺️ [OPTIMIZATION] Geocoding: ${locationsNeedingGeocoding.length} locations need geocoding, ${locationsWithValidData.length} already have valid data`);
      setRegenerationProgress(35);
      setRegenerationStep(`Geocoding ${locationsNeedingGeocoding.length} location(s)...`);
      // Step 3 is already set to loading from handleExtractUpdates

      // Only geocode locations that actually need it
      const geocodedLocations = await geocodeLocations(locationsNeedingGeocoding, tripDestination);

      // Combine geocoded locations with those that already had valid data
      // Preserve original order by matching indices
      const finalValidLocations = validLocations.map((loc: any) => {
        if (needsGeocoding(loc)) {
          // Find this location in geocoded results
          const geocoded = geocodedLocations.find((g: any) => g.id === loc.id);
          return geocoded || loc;
        }
        return loc; // Already has valid coordinates and complete address
      });

      console.log('✅ [DEBUG] Final locations ready');
      finalValidLocations.forEach((loc: any, idx: number) => {
        console.log(`   ${idx + 1}. ${loc.name} - (${loc.lat}, ${loc.lng})`);
      });
      setRegenerationProgress(45);
      setRegenerationStep('Fetching updated data for all locations...');
      setRegenerationSteps(prev => prev.map(s =>
        s.id === '3' ? { ...s, status: 'completed' as const } :
          s.id === '4' ? { ...s, status: 'loading' as const } : s
      ));

      // Get updated trip date (from AI comparison or use current)
      const comparisonData = comparisonDiff.comparisonData;
      const updatedTripDate = comparisonData?.tripDateNew ||
        (comparisonData?.tripDateChanged ? extractedUpdates.date : tripData.tripDate) ||
        tripData.tripDate;

      // Get merged notes (from AI comparison)
      const mergedNotes = comparisonDiff.mergedNotes || driverNotes;

      // Get updated passenger info (from AI comparison)
      const updatedPassengerName = comparisonData?.passengerInfoNew ||
        (comparisonData?.passengerInfoChanged ? (extractedUpdates.leadPassengerName || extractedUpdates.passengerNames?.join(', ')) : leadPassengerName) ||
        leadPassengerName;

      // Get updated vehicle info (from AI comparison)
      const updatedVehicleInfo = comparisonData?.vehicleInfoNew ||
        (comparisonData?.vehicleInfoChanged ? extractedUpdates.vehicleInfo : vehicleInfo) ||
        vehicleInfo;

      // Get updated passenger count
      const updatedPassengerCount = comparisonData?.passengerCountNew ||
        (comparisonData?.passengerCountChanged ? extractedUpdates.passengerCount : passengerCount) ||
        passengerCount;

      // Get updated trip destination
      const updatedTripDestination = comparisonData?.tripDestinationNew ||
        (comparisonData?.tripDestinationChanged ? extractedUpdates.tripDestination : tripDestination) ||
        tripDestination;

      // Parse trip date
      const tripDateObj = new Date(updatedTripDate);

      // Get passenger names array
      const updatedPassengerNames = extractedUpdates.passengerNames || [];

      // Call the regeneration function
      setRegenerationProgress(50);
      setRegenerationStep('Analyzing trip data...');
      await performTripAnalysisUpdate(
        finalValidLocations,
        tripDateObj,
        updatedPassengerName,
        updatedVehicleInfo,
        updatedPassengerCount,
        updatedTripDestination,
        updatedPassengerNames,
        mergedNotes,
        comparisonDiff
      );
    } catch (err) {
      console.error('Error regenerating report:', err);
      setError(err instanceof Error ? err.message : 'Failed to regenerate report');
      setIsRegenerating(false);
    }
  };

  return {
    handleRegenerateDirectly,
  };
};

