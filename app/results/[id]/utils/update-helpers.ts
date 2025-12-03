/**
 * Update Helpers
 * 
 * Utility functions for processing trip updates extracted from text.
 * Used by handleExtractUpdates and related update flows.
 */

import { isAirportLocation } from './location-helpers';

/**
 * Strips email metadata (headers, command markers) from update text
 */
export const stripEmailMetadata = (text: string): string => {
  console.log('🧹 [PRE-PROCESSING] Stripping email headers...');

  // Remove standalone email headers ONLY (headers on their own line or with just email/date after colon)
  // Match patterns like "From: email@domain.com\n" or "Subject: Some Subject\n"
  // But DON'T match "Date: 12 nov 2025 hey there..." (has content after date)
  let cleaned = text
    // Remove "From: email@domain.com"
    .replace(/^From:\s*[^\n]+@[^\n]+$/gim, '')
    // Remove "To: email@domain.com"  
    .replace(/^To:\s*[^\n]+@[^\n]+$/gim, '')
    // Remove "Subject: ..." on its own line
    .replace(/^Subject:\s*[^\n]+$/gim, '')
    // Remove "Date: DD MMM YYYY HH:MM" ONLY if it's at start and followed by newline or just whitespace
    .replace(/^Date:\s*\d{1,2}\s+[a-z]{3}\s+\d{4}\s+\d{2}:\d{2}\s*$/gim, '')
    .replace(/^Cc:\s*[^\n]+$/gim, '')
    .replace(/^Bcc:\s*[^\n]+$/gim, '')
    .replace(/^\s*[\r\n]+/gm, '') // Remove empty lines
    .trim();

  // If Date: is inline with content, just remove the date portion
  // "Date: 12 nov 2025 08:11  hey again..." → "  hey again..."
  cleaned = cleaned.replace(/^Date:\s*\d{1,2}\s+[a-z]{3}\s+\d{4}\s+\d{2}:\d{2}\s+/gim, '');

  // Remove command markers (EXTRAER VIAJE, EXTRACT TRIP, etc.)
  cleaned = cleaned.replace(/\s+EXTRAER\s+VIAJE\s*$/i, '');
  cleaned = cleaned.replace(/\s+EXTRACT\s+TRIP\s*$/i, '');

  const removedChars = text.length - cleaned.length;
  if (removedChars > 0) {
    console.log(`✅ [PRE-PROCESSING] Removed ${removedChars} characters of email metadata`);
  }

  return cleaned.trim();
};

/**
 * Detects which fields should remain unchanged based on "same" language in update text
 */
export const detectUnchangedFields = (updateText: string): Set<string> => {
  const text = updateText.toLowerCase();
  const unchangedFields = new Set<string>();

  // Detect "same" language indicating most fields unchanged
  const hasSameLanguage = text.includes('rest same') || text.includes('same same') ||
    text.includes('everything else same') || text.includes('rest unchanged');

  if (hasSameLanguage) {
    console.log('🔍 [POST-PROCESSING] Detected "same" language - will validate extracted fields');

    // If update doesn't explicitly mention these fields, they should be unchanged
    if (!text.includes('vehicle') && !text.includes('car') && !text.includes('mercedes') &&
      !text.includes('bmw') && !text.includes('audi')) {
      unchangedFields.add('vehicle');
    }
    if (!text.includes('passenger') && !text.match(/mr\.|ms\.|mrs\.|dr\./)) {
      unchangedFields.add('passengers');
    }
    if (!text.match(/\d{1,2}\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i) &&
      !text.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s*\d{1,2}/i)) {
      unchangedFields.add('date');
    }
  }

  return unchangedFields;
};

/**
 * Location matching result
 */
interface LocationMatch {
  matched: boolean;
  index?: number;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Manual form location format
 */
export interface ManualFormLocation {
  location: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  time: string;
  purpose: string;
  confidence: 'high' | 'medium' | 'low';
  verified: boolean;
  placeId: string;
  originalIndex: number;
}

/**
 * Extracted data from AI
 */
export interface ExtractedData {
  locations?: Array<{
    location?: string;
    formattedAddress?: string;
    lat?: number;
    lng?: number;
    time?: string;
    purpose?: string;
    locationIndex?: number;
    insertAfter?: string;
    insertBefore?: string;
    verified?: boolean;
    placeId?: string;
    confidence?: 'high' | 'medium' | 'low';
    [key: string]: any;
  }>;
  removedLocations?: string[];
  [key: string]: any;
}

/**
 * Maps AI-extracted data to manual form format (editingLocations)
 * Returns locations without the temporary originalIndex field
 */
export const mapExtractedToManualForm = (
  currentLocations: any[],
  extractedData: ExtractedData
): Omit<ManualFormLocation, 'originalIndex'>[] => {
  console.log('🔄 [MAP] Mapping extracted data to manual form format...');
  console.log(`📍 [MAP] Current locations: ${currentLocations.length}`);
  console.log(`📍 [MAP] Extracted locations: ${extractedData.locations?.length || 0}`);
  console.log(`🗑️ [MAP] Removals: ${extractedData.removedLocations?.length || 0}`);

  // Step 1: Convert current locations to manual form format
  let manualLocations: ManualFormLocation[] = currentLocations.map((loc, idx) => ({
    location: loc.name || loc.fullAddress || '',
    formattedAddress: loc.fullAddress || loc.formattedAddress || '', // Never fall back to name (purpose)
    lat: loc.lat || 0,
    lng: loc.lng || 0,
    time: loc.time || '12:00',
    purpose: loc.name || '', // Purpose is always from name, never fall back to fullAddress
    confidence: 'high' as 'high' | 'medium' | 'low',
    verified: true,
    placeId: loc.id || `location-${idx + 1}`,
    originalIndex: idx, // Keep track of original index for change tracking
  }));

  // Step 2: Apply removals with improved matching (FIX 2)
  if (extractedData.removedLocations && extractedData.removedLocations.length > 0) {
    const beforeCount = manualLocations.length;
    manualLocations = manualLocations.filter((loc, idx) => {
      const locText = `${loc.location} ${loc.purpose}`.toLowerCase();

      const shouldRemove = extractedData.removedLocations!.some((removal: string) => {
        const removalLower = removal.toLowerCase().trim();
        const removalWords = removalLower.split(/\s+/).filter(w => w.length > 0);

        // Strategy 1: Exact phrase match (highest confidence)
        if (locText.includes(removalLower)) {
          return true;
        }

        // Strategy 2: All words present (for "Mori Tower" matching "Stop at Mori Tower")
        if (removalWords.length > 1 && removalWords.every(word => locText.includes(word))) {
          return true;
        }

        // Strategy 3: Word boundary matching (prevents "tower" matching "Tower Entrance" when removal is single word)
        if (removalWords.length === 1) {
          // Single word: use word boundary or exact match
          const wordBoundaryRegex = new RegExp(`\\b${removalWords[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          return wordBoundaryRegex.test(locText);
        }

        return false;
      });

      if (shouldRemove) {
        const matchedRemoval = extractedData.removedLocations!.find((r: string) => {
          const removalLower = r.toLowerCase().trim();
          const removalWords = removalLower.split(/\s+/).filter(w => w.length > 0);
          const locText = `${loc.location} ${loc.purpose}`.toLowerCase();

          if (locText.includes(removalLower)) return true;
          if (removalWords.length > 1 && removalWords.every(word => locText.includes(word))) return true;
          if (removalWords.length === 1) {
            const wordBoundaryRegex = new RegExp(`\\b${removalWords[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            return wordBoundaryRegex.test(locText);
          }
          return false;
        });
        console.log(`🗑️ [MAP] Removing location ${idx + 1}: ${loc.location} (matched: "${matchedRemoval}")`);
      }

      return !shouldRemove;
    });
    console.log(`✅ [MAP] Removed ${beforeCount - manualLocations.length} location(s)`);
  }

  // Step 3: Helper function to match extracted location to current
  const matchExtractedToCurrent = (extractedLoc: any, currentLocs: ManualFormLocation[]): LocationMatch => {
    // Strategy 1: Index-based matching (if locationIndex provided)
    if (extractedLoc.locationIndex !== undefined) {
      const targetIdx = extractedLoc.locationIndex;
      if (targetIdx >= 0 && targetIdx < currentLocs.length) {
        console.log(`✅ [MAP] Index match: locationIndex ${targetIdx}`);
        return { matched: true, index: targetIdx, confidence: 'high' };
      }
    }

    // Strategy 2: Pickup/dropoff matching
    // Check both location name AND purpose field (purpose is where pickup/dropoff keywords are stored)
    const locNameLower = (extractedLoc.location || '').toLowerCase();
    const purposeLower = (extractedLoc.purpose || '').toLowerCase();
    const combinedText = `${locNameLower} ${purposeLower}`;

    const isPickup = combinedText.includes('pickup') || combinedText.includes('pick up') || combinedText.includes('collection');
    const isDropoff = combinedText.includes('dropoff') || combinedText.includes('drop off') || combinedText.includes('destination');

    if (isPickup && currentLocs.length > 0) {
      console.log(`✅ [MAP] Pickup match: index 0 (from purpose: "${extractedLoc.purpose}")`);
      return { matched: true, index: 0, confidence: 'high' };
    }
    if (isDropoff && currentLocs.length > 0) {
      console.log(`✅ [MAP] Dropoff match: index ${currentLocs.length - 1} (from purpose: "${extractedLoc.purpose}")`);
      return { matched: true, index: currentLocs.length - 1, confidence: 'high' };
    }

    // Strategy 2.5: Arrival/departure keyword matching
    // Arrival = pickup (where passenger arrives), Departure = dropoff (where passenger departs)
    const isArrival = combinedText.includes('arrival') || combinedText.includes('arrive') || combinedText.includes('arriving') ||
      combinedText.includes('landing') || combinedText.includes('land') || combinedText.includes('arrived');
    const isDeparture = combinedText.includes('departure') || combinedText.includes('depart') || combinedText.includes('departing') ||
      combinedText.includes('leaving') || combinedText.includes('leave') || combinedText.includes('departed');

    if (isArrival && currentLocs.length > 0) {
      console.log(`✅ [MAP] Arrival match → Pickup: index 0 (from purpose: "${extractedLoc.purpose}")`);
      return { matched: true, index: 0, confidence: 'high' };
    }
    if (isDeparture && currentLocs.length > 0) {
      console.log(`✅ [MAP] Departure match → Dropoff: index ${currentLocs.length - 1} (from purpose: "${extractedLoc.purpose}")`);
      return { matched: true, index: currentLocs.length - 1, confidence: 'high' };
    }

    // Strategy 3: Name matching (exact, partial, purpose)
    for (let i = 0; i < currentLocs.length; i++) {
      const current = currentLocs[i];
      const currentName = (current.location || '').toLowerCase();
      const currentPurpose = (current.purpose || '').toLowerCase();
      const extractedName = (extractedLoc.location || '').toLowerCase();
      const extractedPurpose = (extractedLoc.purpose || '').toLowerCase();

      // Exact match
      if (extractedName === currentName || extractedName === currentPurpose) {
        console.log(`✅ [MAP] Exact name match: index ${i}`);
        return { matched: true, index: i, confidence: 'high' };
      }

      // Partial match (extracted contains current or vice versa)
      if (extractedName && currentName && (
        extractedName.includes(currentName) ||
        currentName.includes(extractedName) ||
        extractedName.includes(currentPurpose) ||
        currentPurpose.includes(extractedName)
      )) {
        console.log(`✅ [MAP] Partial name match: index ${i}`);
        return { matched: true, index: i, confidence: 'medium' };
      }

      // Purpose match
      if (extractedPurpose && currentPurpose && (
        extractedPurpose === currentPurpose ||
        extractedPurpose.includes(currentPurpose) ||
        currentPurpose.includes(extractedPurpose)
      )) {
        console.log(`✅ [MAP] Purpose match: index ${i}`);
        return { matched: true, index: i, confidence: 'medium' };
      }
    }

    return { matched: false, confidence: 'low' };
  };

  // Step 4: Apply modifications (locations that match existing ones)
  if (extractedData.locations && extractedData.locations.length > 0) {
    extractedData.locations.forEach((extractedLoc: any) => {
      // First, try to match the location (including arrival/departure → pickup/dropoff)
      const match = matchExtractedToCurrent(extractedLoc, manualLocations);

      // If it matches pickup/dropoff (including via arrival/departure keywords), treat as modification
      // even if it has insertAfter/insertBefore metadata (those are likely false positives)
      const isPickupOrDropoffMatch = match.matched && match.index !== undefined &&
        (match.index === 0 || match.index === manualLocations.length - 1);

      // Skip to additions only if:
      // 1. It doesn't match AND has insertion metadata, OR
      // 2. It doesn't match AND doesn't have insertion metadata (will be handled in additions)
      if (!match.matched && (extractedLoc.insertAfter || extractedLoc.insertBefore)) {
        return; // Will be handled in additions step
      }

      // If it matches (especially pickup/dropoff), treat as modification regardless of insertion metadata
      if (match.matched && match.index !== undefined) {
        const idx = match.index;
        console.log(`✏️ [MAP] Modifying location ${idx + 1}: ${manualLocations[idx].location} → ${extractedLoc.location}`);

        // Only update time if it was explicitly provided and is different from current
        // Preserve original time if extracted time is empty, same, or appears to be a default
        // The extraction API often returns "12:00" as a default when no time is mentioned
        const extractedTime = extractedLoc.time?.trim() || '';
        const currentTime = manualLocations[idx].time || '';
        const timeIsDifferent = extractedTime && extractedTime !== currentTime;

        // Check if the extracted time looks like a meaningful change (not just a default)
        // The extraction API often returns "12:00" as a default when no time is mentioned
        // Strategy: If extracted time is "12:00" and current time exists, preserve current time
        // Only update time if:
        // 1. Extracted time is NOT "12:00" (likely intentional)
        // 2. Current time doesn't exist (use extracted as fallback)
        // 3. Extracted time matches current time (no change needed, but handled above)
        let shouldUpdateTime = false;
        if (timeIsDifferent) {
          if (!currentTime) {
            // No current time exists, use extracted time
            shouldUpdateTime = true;
          } else if (extractedTime === '12:00' && currentTime !== '12:00') {
            // Extracted time is "12:00" (likely default) and current time exists
            // Preserve current time - don't update
            shouldUpdateTime = false;
          } else {
            // Extracted time is not "12:00" or matches current, likely intentional
            shouldUpdateTime = true;
          }
        }

        manualLocations[idx] = {
          ...manualLocations[idx],
          location: extractedLoc.location || manualLocations[idx].location,
          formattedAddress: extractedLoc.formattedAddress || manualLocations[idx].formattedAddress,
          lat: (extractedLoc.lat && extractedLoc.lat !== 0) ? extractedLoc.lat : manualLocations[idx].lat,
          lng: (extractedLoc.lng && extractedLoc.lng !== 0) ? extractedLoc.lng : manualLocations[idx].lng,
          time: shouldUpdateTime ? extractedTime : currentTime,
          purpose: extractedLoc.purpose || manualLocations[idx].purpose,
          verified: extractedLoc.verified !== undefined ? extractedLoc.verified : manualLocations[idx].verified,
          placeId: extractedLoc.placeId || manualLocations[idx].placeId,
          confidence: match.confidence as 'high' | 'medium' | 'low',
          originalIndex: manualLocations[idx].originalIndex,
        };

        if (shouldUpdateTime) {
          console.log(`⏰ [MAP] Time updated for location ${idx + 1}: ${currentTime} → ${extractedTime}`);
        } else if (timeIsDifferent) {
          console.log(`⏰ [MAP] Time preserved for location ${idx + 1} (extracted "${extractedTime}" appears to be default, keeping "${currentTime}")`);
        }
      }
    });
  }

  // Step 5: Apply additions (new locations and insertions)
  if (extractedData.locations && extractedData.locations.length > 0) {
    const additions = extractedData.locations.filter((loc: any) => {
      // First check if it matches (including arrival/departure → pickup/dropoff)
      const match = matchExtractedToCurrent(loc, manualLocations);

      // If it matches pickup/dropoff, it's NOT an addition (should have been handled in Step 4)
      if (match.matched && match.index !== undefined &&
        (match.index === 0 || match.index === manualLocations.length - 1)) {
        return false; // Already handled as modification
      }

      // It's an addition if:
      // 1. Doesn't match any existing location AND has insertAfter/insertBefore (explicit insertion)
      // 2. Doesn't match any existing location (will be appended)
      if (!match.matched && (loc.insertAfter || loc.insertBefore)) return true;
      return !match.matched;
    });

    // Helper function to find reference location index
    const findReferenceIndex = (reference: string, currentLocs: ManualFormLocation[]): number => {
      const refLower = reference.toLowerCase().trim();

      // Try multiple matching strategies
      for (let i = 0; i < currentLocs.length; i++) {
        const loc = currentLocs[i];
        const locName = (loc.location || '').toLowerCase();
        const locPurpose = (loc.purpose || '').toLowerCase();
        const locFormatted = (loc.formattedAddress || '').toLowerCase();
        const combinedText = `${locName} ${locPurpose} ${locFormatted}`;

        // Strategy 1: Exact match in any field
        if (locName === refLower || locPurpose === refLower || locFormatted.includes(refLower)) {
          return i;
        }

        // Strategy 2: Reference is contained in location name or purpose
        if (locName.includes(refLower) || locPurpose.includes(refLower)) {
          return i;
        }

        // Strategy 3: Location name or purpose is contained in reference (for partial matches)
        if (refLower.includes(locName) || refLower.includes(locPurpose)) {
          return i;
        }

        // Strategy 4: Word-by-word matching (for "Soho House" matching "Soho House 76 Dean Street")
        const refWords = refLower.split(/\s+/).filter(w => w.length > 2); // Ignore short words
        if (refWords.length > 0 && refWords.every(word => combinedText.includes(word))) {
          return i;
        }
      }

      return -1;
    };

    additions.forEach((extractedLoc: any) => {
      // Parse insertAfter/insertBefore from purpose if not explicitly provided
      let insertAfter = extractedLoc.insertAfter;
      let insertBefore = extractedLoc.insertBefore;

      if (!insertAfter && !insertBefore && extractedLoc.purpose) {
        const purposeLower = (extractedLoc.purpose || '').toLowerCase();
        // Check for "after [location]" pattern
        const afterMatch = purposeLower.match(/(?:after|following|post)\s+(.+?)(?:\s|$)/);
        if (afterMatch && afterMatch[1]) {
          insertAfter = afterMatch[1].trim();
          console.log(`🔍 [MAP] Parsed insertAfter from purpose: "${insertAfter}"`);
        }
        // Check for "before [location]" pattern
        const beforeMatch = purposeLower.match(/(?:before|prior to|pre)\s+(.+?)(?:\s|$)/);
        if (beforeMatch && beforeMatch[1]) {
          insertBefore = beforeMatch[1].trim();
          console.log(`🔍 [MAP] Parsed insertBefore from purpose: "${insertBefore}"`);
        }
      }

      const newLocation: ManualFormLocation = {
        location: extractedLoc.location || '',
        formattedAddress: extractedLoc.formattedAddress || extractedLoc.location || '',
        lat: extractedLoc.lat || 0,
        lng: extractedLoc.lng || 0,
        time: extractedLoc.time || '12:00',
        purpose: extractedLoc.purpose || extractedLoc.location || '',
        confidence: (extractedLoc.confidence || 'medium') as 'high' | 'medium' | 'low',
        verified: extractedLoc.verified !== undefined ? extractedLoc.verified : false,
        placeId: extractedLoc.placeId || `new-location-${Date.now()}-${Math.random()}`,
        originalIndex: -1, // New locations don't have original index
      };

      // FIX 3: Validate location has required fields before adding
      const hasValidLocation = newLocation.location.trim() !== '' ||
        newLocation.formattedAddress.trim() !== '';
      const hasValidCoords = (newLocation.lat !== 0 && newLocation.lng !== 0) ||
        (extractedLoc.lat !== 0 && extractedLoc.lng !== 0);
      // Exception: Airport locations are valid even without coordinates if they match airport pattern
      const isAirport = isAirportLocation(newLocation.location) || 
                       isAirportLocation(newLocation.formattedAddress);

      if (!hasValidLocation && !isAirport) {
        console.warn(`⚠️ [MAP] Skipping empty location: location="${newLocation.location}", formattedAddress="${newLocation.formattedAddress}"`);
        console.warn(`   - This location will not be added to the trip`);
        return; // Skip this location
      }

      if (!hasValidCoords && !extractedLoc.verified) {
        console.warn(`⚠️ [MAP] Location "${newLocation.location}" has no coordinates and is not verified, but adding anyway (will be geocoded later)`);
      }

      if (insertAfter) {
        // Find reference location using improved matching
        const refIndex = findReferenceIndex(insertAfter, manualLocations);

        if (refIndex !== -1) {
          console.log(`➕ [MAP] Inserting after location ${refIndex + 1} (${manualLocations[refIndex].location}): ${extractedLoc.location}`);
          manualLocations.splice(refIndex + 1, 0, newLocation);
        } else {
          console.log(`⚠️ [MAP] Could not find reference "${insertAfter}", appending at end`);
          manualLocations.push(newLocation);
        }
      } else if (insertBefore) {
        // Find reference location using improved matching
        const refIndex = findReferenceIndex(insertBefore, manualLocations);

        if (refIndex !== -1) {
          console.log(`➕ [MAP] Inserting before location ${refIndex + 1} (${manualLocations[refIndex].location}): ${extractedLoc.location}`);
          manualLocations.splice(refIndex, 0, newLocation);
        } else {
          console.log(`⚠️ [MAP] Could not find reference "${insertBefore}", appending at end`);
          manualLocations.push(newLocation);
        }
      } else {
        // Append at end
        console.log(`➕ [MAP] Adding new location at end: ${extractedLoc.location}`);
        manualLocations.push(newLocation);
      }
    });
  }

  // Remove temporary tracking fields before returning
  return manualLocations.map(({ originalIndex, ...loc }) => loc);
};

/**
 * Change set for preview display
 */
export interface ChangeSet {
  removed: Array<{ index: number; location: any }>;
  modified: number[];
  added: number[];
  originalLocationMap: Map<number, any>;
}

/**
 * Calculates changes between current and mapped locations for preview display
 */
export const calculateChanges = (currentLocations: any[], mappedLocations: any[]): ChangeSet => {
  const changes: ChangeSet = {
    removed: [], // Store removed location data
    modified: [], // Indices in mappedLocations
    added: [], // Indices in mappedLocations
    originalLocationMap: new Map<number, any>(), // Map from mappedLocations index to original location
  };

  // Track which current locations were matched
  const matchedIndices = new Set<number>();

  // Find modifications and additions (locations in mappedLocations)
  mappedLocations.forEach((mappedLoc, mappedIdx) => {
    // Try to find matching current location
    const currentIdx = currentLocations.findIndex((currentLoc, idx) => {
      if (matchedIndices.has(idx)) return false; // Already matched

      const nameMatch = (currentLoc.name || '').toLowerCase() === (mappedLoc.location || '').toLowerCase() ||
        (currentLoc.fullAddress || '').toLowerCase() === (mappedLoc.formattedAddress || '').toLowerCase();
      const coordMatch = currentLoc.lat === mappedLoc.lat && currentLoc.lng === mappedLoc.lng;

      return nameMatch || coordMatch;
    });

    if (currentIdx !== -1) {
      matchedIndices.add(currentIdx);
      const current = currentLocations[currentIdx];
      // Store mapping from mappedLocations index to original location
      changes.originalLocationMap.set(mappedIdx, current);

      // Check if it was modified
      const modified =
        (current.name || '') !== (mappedLoc.location || '') ||
        (current.fullAddress || '') !== (mappedLoc.formattedAddress || '') ||
        (current.time || '') !== (mappedLoc.time || '') ||
        current.lat !== mappedLoc.lat ||
        current.lng !== mappedLoc.lng;

      if (modified) {
        changes.modified.push(mappedIdx);
      }
    } else {
      // New location (not found in current)
      changes.added.push(mappedIdx);
    }
  });

  // Find removals (current locations not in mapped)
  currentLocations.forEach((currentLoc, idx) => {
    if (!matchedIndices.has(idx)) {
      // This location was removed
      changes.removed.push({ index: idx, location: currentLoc });
    }
  });

  return changes;
};

