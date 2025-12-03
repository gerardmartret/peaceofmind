/**
 * useUpdateExtraction Hook
 * 
 * Handles extracting trip updates from text input.
 * Processes the text, calls the extraction API, and prepares preview data.
 */

import { stripEmailMetadata, detectUnchangedFields, mapExtractedToManualForm, calculateChanges } from '../utils/update-helpers';

interface UseUpdateExtractionParams {
  updateText: string;
  tripData: any;
  tripDestination: string;
  driverNotes: string;
  leadPassengerName: string;
  vehicleInfo: string;
  passengerCount: number;
  isAuthenticated: boolean;
  isOwner: boolean;
  isGuestCreator: boolean;
  setIsExtracting: (extracting: boolean) => void;
  setError: (error: string | null) => void;
  setUpdateProgress: (progress: { step: string; error: string | null; canRetry: boolean }) => void;
  setExtractedUpdates: (updates: any) => void;
  setPreviewLocations: (locations: any[]) => void;
  setPreviewChanges: (changes: any) => void;
  setPreviewDriverNotes: (notes: string) => void;
  setPreviewNonLocationFields: (fields: any) => void;
  setOriginalValues: (values: any) => void;
  setLeadPassengerName: (name: string) => void;
  setVehicleInfo: (info: string) => void;
  setPassengerCount: (count: number) => void;
  setTripDestination: (destination: string) => void;
  setShowPreviewModal: (show: boolean) => void;
  setShowSignupModal: (show: boolean) => void;
  updateProgress: { step: string; error: string | null; canRetry: boolean };
}

export const useUpdateExtraction = (params: UseUpdateExtractionParams) => {
  const {
    updateText,
    tripData,
    tripDestination,
    driverNotes,
    leadPassengerName,
    vehicleInfo,
    passengerCount,
    isAuthenticated,
    isOwner,
    isGuestCreator,
    setIsExtracting,
    setError,
    setUpdateProgress,
    setExtractedUpdates,
    setPreviewLocations,
    setPreviewChanges,
    setPreviewDriverNotes,
    setPreviewNonLocationFields,
    setOriginalValues,
    setLeadPassengerName,
    setVehicleInfo,
    setPassengerCount,
    setTripDestination,
    setShowPreviewModal,
    setShowSignupModal,
    updateProgress,
  } = params;

  const handleExtractUpdates = async () => {
    // Check if user is authenticated - if not, show signup modal
    if (!isAuthenticated) {
      setShowSignupModal(true);
      return;
    }

    // Security check: Only owners and guest creators can extract updates
    if (!isOwner && !isGuestCreator) {
      console.error('❌ Unauthorized: Only trip owners and guest creators can extract updates');
      setError('Only trip owners can update trip information');
      return;
    }

    if (!updateText.trim()) return;

    // Don't show regeneration modal during extraction - it will show when user accepts preview
    setIsExtracting(true);
    setError(null);
    setUpdateProgress({ step: 'Extracting trip data', error: null, canRetry: false });

    try {
      // PRE-PROCESSING: Strip email headers to prevent false positives
      const cleanedText = stripEmailMetadata(updateText);

      // Step 1: Extract updates from text
      console.log('🔄 Step 1: Extracting updates from text...');

      const extractResponse = await fetch('/api/extract-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanedText,  // Use cleaned text without email headers
          tripDestination: tripDestination || undefined // Pass current trip destination for proper geocoding
        }),
      });

      const extractedData = await extractResponse.json();

      if (!extractedData.success) {
        const errorMsg = extractedData.error || 'Could not understand the update text';
        console.error('❌ Extraction failed:', errorMsg);
        setError(errorMsg);
        setUpdateProgress({
          step: 'Extraction',
          error: 'Could not understand the update. Try rephrasing or breaking it into smaller pieces. For example: "Change pickup time to 3pm" or "Add stop at The Ritz Hotel"',
          canRetry: true,
        });
        setIsExtracting(false);
        return;
      }

      // POST-PROCESSING: Log removal operations if detected
      if (extractedData.removedLocations && extractedData.removedLocations.length > 0) {
        console.log(`🗑️ [REMOVAL] Detected ${extractedData.removedLocations.length} location(s) to remove:`, extractedData.removedLocations);
      }

      // POST-PROCESSING: Log insertion operations if detected
      if (extractedData.locations && extractedData.locations.length > 0) {
        extractedData.locations.forEach((loc: any, idx: number) => {
          if (loc.insertAfter) {
            console.log(`📌 [INSERT] Location "${loc.location}" should be inserted AFTER "${loc.insertAfter}"`);
          } else if (loc.insertBefore) {
            console.log(`📌 [INSERT] Location "${loc.location}" should be inserted BEFORE "${loc.insertBefore}"`);
          }
        });
      }

      // POST-PROCESSING: Validate and override fields based on "same" language
      const unchangedFields = detectUnchangedFields(updateText);

      if (unchangedFields.size > 0) {
        console.log(`🔧 [POST-PROCESSING] Found ${unchangedFields.size} field(s) that should be unchanged:`, Array.from(unchangedFields));

        if (unchangedFields.has('vehicle') && extractedData.vehicleInfo) {
          console.log(`   → Ignoring extracted vehicle: "${extractedData.vehicleInfo}"`);
          extractedData.vehicleInfo = null;
        }
        if (unchangedFields.has('passengers') && extractedData.leadPassengerName) {
          console.log(`   → Ignoring extracted passenger data`);
          extractedData.leadPassengerName = null;
          extractedData.passengerNames = [];
        }
        if (unchangedFields.has('date') && extractedData.date) {
          console.log(`   → Ignoring extracted date: "${extractedData.date}"`);
          extractedData.date = null;
        }
      }

      // POST-PROCESSING: Validate date - must be today or later
      if (extractedData.date) {
        try {
          const extractedDate = new Date(extractedData.date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          extractedDate.setHours(0, 0, 0, 0);

          // Date must be today or later (date < today means invalid)
          if (extractedDate < today) {
            console.warn(`⚠️ [VALIDATION] Extracted date ${extractedData.date} is in the past. Setting to null (date must be today or later).`);
            extractedData.date = null;
          } else {
            console.log(`✅ [VALIDATION] Extracted date ${extractedData.date} is valid (today or later)`);
          }
        } catch (error) {
          console.error(`❌ [VALIDATION] Invalid date format: ${extractedData.date}`, error);
          extractedData.date = null;
        }
      }

      console.log('✅ Step 1 complete: Extracted data successfully');
      setExtractedUpdates(extractedData);

      // Step 2: Map extracted data to manual form format (replacing comparison step)
      if (tripData) {
        setUpdateProgress({ step: 'Mapping updates to trip format', error: null, canRetry: false });
        console.log('🔄 [UPDATE] Step 2: Mapping extracted data to manual form format...');
        console.log('📍 [UPDATE] Current:', tripData.locations.length, 'locations');
        console.log('📍 [UPDATE] Extracted:', extractedData.locations?.length || 0, 'locations');

        try {
          // Map extracted data to manual form format
          const mappedLocations = mapExtractedToManualForm(tripData.locations, extractedData);

          // Calculate changes for preview
          const changes = calculateChanges(tripData.locations, mappedLocations);

          // Update trip notes if changed
          const newDriverNotes = extractedData.driverNotes || driverNotes;
          const notesChanged = extractedData.driverNotes && extractedData.driverNotes !== driverNotes;

          console.log('✅ [UPDATE] Step 2: Mapping successful');
          console.log('📊 [UPDATE] Changes:', {
            removed: changes.removed.length,
            modified: changes.modified.length,
            added: changes.added.length,
            notesChanged: notesChanged
          });

          // Store original values from tripData BEFORE updating state
          const originalValuesData = {
            leadPassengerName: leadPassengerName,
            vehicleInfo: vehicleInfo,
            passengerCount: passengerCount,
            tripDestination: tripDestination,
            driverNotes: driverNotes,
          };
          setOriginalValues(originalValuesData);

          // Track non-location field changes (compare against original values)
          const nonLocationChanges: any = {};
          if (extractedData.leadPassengerName && extractedData.leadPassengerName !== originalValuesData.leadPassengerName) {
            nonLocationChanges.leadPassengerName = extractedData.leadPassengerName;
          }
          if (extractedData.vehicleInfo && extractedData.vehicleInfo !== originalValuesData.vehicleInfo) {
            nonLocationChanges.vehicleInfo = extractedData.vehicleInfo;
          }
          if (extractedData.passengerCount && extractedData.passengerCount !== originalValuesData.passengerCount) {
            nonLocationChanges.passengerCount = extractedData.passengerCount;
          }
          if (extractedData.tripDestination && extractedData.tripDestination !== originalValuesData.tripDestination) {
            nonLocationChanges.tripDestination = extractedData.tripDestination;
          }

          // Set preview data
          setPreviewLocations(mappedLocations);
          setPreviewChanges(changes);
          setPreviewDriverNotes(newDriverNotes);
          setPreviewNonLocationFields(nonLocationChanges);

          // Update other fields if changed (for immediate state update)
          if (extractedData.leadPassengerName) {
            setLeadPassengerName(extractedData.leadPassengerName);
          }
          if (extractedData.vehicleInfo) {
            setVehicleInfo(extractedData.vehicleInfo);
          }
          if (extractedData.passengerCount) {
            setPassengerCount(extractedData.passengerCount);
          }
          if (extractedData.tripDestination) {
            setTripDestination(extractedData.tripDestination);
          }

          // Show preview modal (regeneration modal will show when user accepts)
          setIsExtracting(false);
          setShowPreviewModal(true);

        } catch (mapError) {
          console.error('❌ [UPDATE] Mapping failed:', mapError);
          setError(mapError instanceof Error ? mapError.message : 'Failed to map updates');
          setUpdateProgress({
            step: 'Mapping',
            error: 'Could not map updates to trip format. Please try using the manual form.',
            canRetry: true,
          });
          setIsExtracting(false);
        }
      }
    } catch (err) {
      console.error('❌ Unexpected error during update extraction:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      setUpdateProgress({
        step: updateProgress.step || 'Processing update',
        error: `Something went wrong during ${updateProgress.step || 'the update process'}. ${errorMessage}`,
        canRetry: true,
      });
      setIsExtracting(false);
    }
  };

  return {
    handleExtractUpdates,
  };
};

