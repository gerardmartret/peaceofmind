/**
 * Vehicle Detection Helpers
 * 
 * Functions to detect vehicle types from text patterns in vehicleInfo and driverNotes.
 * Used to determine which vehicle image and display name to show.
 */

import { isUSCanadaPuertoRicoTrip, isMiddleEastTrip, isEuropeTrip } from '@/lib/city-helpers';

export type VehicleType = 'suv' | 'luxury-suv' | 'sedan' | 'premium-sedan' | 'signature-sedan' | 'minibus' | 'van' | 'comfort-sedan' | null;

/**
 * Checks if text contains comfort sedan patterns (affordable/cheap car terms or specific models)
 * Only triggers when explicitly requested - never as fallback
 */
export const extractComfortSedanInfo = (text: string | null): boolean => {
  if (!text) return false;
  const comfortSedanPatterns = [
    // Affordability terms
    /\b(?:affordable|cheap|budget|economy|regular|normal)\s+(?:car|vehicle|auto)\b/i,
    // Specific comfort sedan models
    /Toyota\s*Camry/i,
    /Toyota\s*Avalon/i,
    /Hyundai\s*Sonata/i,
    /Hyundai\s*Elantra/i,
    /Mazda\s*6/i,
    /Mazda6/i,
    /Mazda\s*3/i,
    /Nissan\s*Altima/i,
    /Nissan\s*Sentra/i,
    /Nissan\s*Maxima/i,
    /Honda\s*Accord/i,
    /Honda\s*Civic/i,
    /Volkswagen\s*Passat/i,
    /VW\s*Passat/i,
    /Volkswagen\s*Jetta/i,
    /VW\s*Jetta/i,
    /Audi\s*A4/i,
    /Kia\s*K5/i,
    /Kia\s*Optima/i,
    /Ford\s*Fusion/i,
    /Ford\s*Taurus/i,
    /Chevrolet\s*Malibu/i,
    /Chevrolet\s*Impala/i,
    /Chevy\s*Malibu/i,
    /Chevy\s*Impala/i,
    /Subaru\s*Legacy/i,
    /Chrysler\s*300/i,
    /Dodge\s*Charger/i,
    /Buick\s*Regal/i,
    /Buick\s*LaCrosse/i,
    /Acura\s*TLX/i,
    /Infiniti\s*Q50/i,
    /Lexus\s*LS/i,
  ];
  return comfortSedanPatterns.some(pattern => pattern.test(text));
};

/**
 * Checks if text contains generic car terms (normal, regular, any car)
 * These should NOT trigger SUV/Escalade, even in location-based fallback
 */
export const extractGenericCarInfo = (text: string | null): boolean => {
  if (!text) return false;
  const genericCarPatterns = [
    /\b(?:normal|regular|any|standard|basic|simple|ordinary|common|typical|usual)\s+(?:car|vehicle|auto)\b/i,
  ];
  return genericCarPatterns.some(pattern => pattern.test(text));
};

/**
 * Extracts car/sedan information from text
 */
export const extractCarInfo = (text: string | null): string | null => {
  if (!text) return null;
  const carPatterns = [
    /(?:Mercedes|Merc)\s*E[\s-]*Class/i,
    /BMW\s*5\s*Series/i,
    /Audi\s*A6/i,
    /Lincoln\s*(?:Continental|MKS)/i,
    /Lexus\s*E350/i,
    /Volvo\s*S90/i,
    /Cadillac\s*XTS/i,
    /\bBusiness\s+Sedan\b/i,
  ];

  for (const pattern of carPatterns) {
    if (pattern.test(text)) {
      return text.match(pattern)?.[0] || null;
    }
  }
  return null;
};

/**
 * Checks if text contains luxury SUV patterns (Range Rover images)
 * These are premium/luxury full-size SUVs that show Range Rover images
 */
export const extractLuxurySUVInfo = (text: string | null): boolean => {
  if (!text) return false;
  const luxurySUVPatterns = [
    // Mercedes luxury SUVs
    /(?:Mercedes|Merc)\s*(?:GLS|GL|G[\s-]*Class)/i,
    // BMW luxury SUVs
    /BMW\s*(?:X[5-9]|XM)/i,
    // Audi luxury SUVs
    /Audi\s*(?:Q7|Q8)/i,
    // Range Rover
    /Range\s*Rover/i,
    // Lexus luxury SUVs
    /Lexus\s*(?:LX|GX)/i,
    // Volvo luxury SUVs
    /Volvo\s*(?:XC70|XC90)/i,
  ];
  return luxurySUVPatterns.some(pattern => pattern.test(text));
};

/**
 * Checks if text contains SUV patterns
 * Only includes full-size/large SUVs - compact and mid-size SUVs are excluded
 * Luxury SUVs (Range Rover images) are handled separately
 */
export const extractSUVInfo = (text: string | null): boolean => {
  if (!text) return false;
  const suvPatterns = [
    /\bSUV\b/i,
    /\b(?:sport\s*utility|sport\s*ute)\b/i,
    /Cadillac\s*(?:Escalade|Escalade\s*ESV|XT[4-6])/i,
    /Lincoln\s*(?:Navigator|Navigator\s*L|Aviator)/i,
    /Ford\s*Expedition/i,
    /Ford\s*Expedition\s*MAX/i,
    /Chevrolet\s*Suburban/i,
    /Chevrolet\s*Tahoe/i,
    /Chevy\s*Suburban/i,
    /Chevy\s*Tahoe/i,
    /GMC\s*Yukon/i,
    /GMC\s*Yukon\s*XL/i,
    /GMC\s*Denali/i,
    /Toyota\s*Sequoia/i,
    /Nissan\s*Armada/i,
    /Infiniti\s*QX80/i,
    /Jeep\s*Grand\s*Wagoneer/i,
    /Jeep\s*Wagoneer/i,
    /Land\s*Rover\s*Defender/i,
    /Land\s*Rover\s*Discovery/i,
    // Lexus - only large/full-size: LX, GX (removed RX, NX)
    /Lexus\s*(?:LX|GX)/i,
    // Porsche - removed (Cayenne and Macan are mid-size/compact)
    // Volvo - only large: XC70, XC90 (removed XC40, XC60)
    /Volvo\s*(?:XC70|XC90)/i,
    /\bBusiness\s+SUV\b/i,
  ];

  return suvPatterns.some(pattern => pattern.test(text));
};

/**
 * Checks if text contains van/V-Class patterns
 */
export const extractVanInfo = (text: string | null): boolean => {
  if (!text) return false;
  const vanPatterns = [
    /\b(?:van|v-class|vclass|minivan)\b/i,
    /(?:Mercedes|Merc)\s*(?:V-Class|VClass)/i,
    /\bBusiness\s+Van\b/i,
  ];

  return vanPatterns.some(pattern => pattern.test(text));
};

/**
 * Checks if text contains minibus/sprinter patterns
 */
export const extractMinibusInfo = (text: string | null): boolean => {
  if (!text) return false;
  const minibusPatterns = [
    /\b(?:minibus|mini\s*bus)\b/i,
    /\b(?:sprinter)\b/i,
    /(?:Mercedes|Merc)\s*(?:Sprinter)/i,
    /\bBusiness\s+(?:Minibus|Sprinter)\b/i,
  ];

  return minibusPatterns.some(pattern => pattern.test(text));
};

/**
 * Checks if text contains premium sedan patterns
 */
export const extractPremiumSedanInfo = (text: string | null): boolean => {
  if (!text) return false;
  const premiumSedanPatterns = [
    // Specific luxury models
    /(?:Mercedes|Merc)\s*S[\s-]*Class/i,
    /BMW\s*7\s*Series/i,
    /Audi\s*A8/i,
    /Lexus\s*LS\s*500/i,
    // Luxury car phrases
    /\b(?:nice|luxury|luxurious|premium|high-end|high\s*end|very\s+good|very\s+nice|top\s+of\s+the\s+line|top\s+of\s+line|best|fancy|expensive|upscale|deluxe)\s+car\b/i,
    /\b(?:nice|luxury|luxurious|premium|high-end|high\s*end|very\s+good|very\s+nice|top\s+of\s+the\s+line|top\s+of\s+line|best|fancy|expensive|upscale|deluxe)\s+vehicle\b/i,
    /\bPremium\s+Sedan\b/i,
  ];

  return premiumSedanPatterns.some(pattern => pattern.test(text));
};

/**
 * Checks if text contains signature sedan (ultra-luxury) patterns
 */
export const extractSignatureSedanInfo = (text: string | null): boolean => {
  if (!text) return false;
  const signatureSedanPatterns = [
    // Specific ultra-luxury models
    /(?:Mercedes|Merc)\s*Maybach\s*S(?:[\s-]*Class)?/i,
    /Maybach\s*(?:Mercedes|Merc)\s*S(?:[\s-]*Class)?/i,
    /Rolls\s*Royce\s*Ghost/i,
    /Rolls\s*Royce\s*Phantom/i,
    // Ultra-luxury car phrases
    /\b(?:very\s+luxurious|very\s+luxury|dream|super\s+elite|super\s+luxury|ultra\s+luxury|ultra\s+luxurious|most\s+luxurious|most\s+luxury|ultimate\s+luxury|ultimate\s+luxurious|exclusive|elite|platinum|signature)\s+car\b/i,
    /\b(?:very\s+luxurious|very\s+luxury|dream|super\s+elite|super\s+luxury|ultra\s+luxury|ultra\s+luxurious|most\s+luxurious|most\s+luxury|ultimate\s+luxury|ultimate\s+luxurious|exclusive|elite|platinum|signature)\s+vehicle\b/i,
    /\b(?:most\s+luxurious|most\s+luxury|most\s+expensive|most\s+premium|most\s+exclusive|most\s+elite)\s+(?:vehicle|car|sedan)\s+(?:possible|available|option)\b/i,
    /\bSignature\s+Sedan\b/i,
  ];

  return signatureSedanPatterns.some(pattern => pattern.test(text));
};

/**
 * Determines vehicle type based on vehicleInfo, driverNotes, passenger count, and trip destination.
 * Priority: van > minibus > SUV > signature sedan > premium sedan > regular sedan > fallback to passenger count
 */
export const determineVehicleType = (
  vehicleInfo: string | null,
  driverNotes: string | null,
  numberOfPassengers: number | null | undefined,
  tripDestination?: string | null
): VehicleType => {
  // Normalize passenger count: if no vehicle specified and no passengers specified, assume Business Sedan with 1 passenger
  const hasVehicleInfo = !!(vehicleInfo && vehicleInfo.trim());
  const hasDriverNotes = !!(driverNotes && driverNotes.trim());
  // Check if passenger count is actually specified (not null/undefined)
  // Note: 0 is considered a valid specification, only null/undefined means "not specified"
  const hasPassengerCount = numberOfPassengers != null;
  
  // If no vehicle info and no passenger count specified, default to Business Sedan (1 passenger)
  const normalizedPassengerCount = (!hasVehicleInfo && !hasDriverNotes && !hasPassengerCount) 
    ? 1 
    : (numberOfPassengers != null ? numberOfPassengers : 0);

  // PRIORITIZE vehicleInfo over driverNotes: If vehicleInfo has a value, ONLY check vehicleInfo
  // Only check driverNotes if vehicleInfo is empty/null
  // This ensures vehicle updates take precedence over old vehicle mentions in driverNotes
  
  // Check for van/V-Class first (highest priority)
  const hasVanPattern = hasVehicleInfo 
    ? extractVanInfo(vehicleInfo || '') 
    : extractVanInfo(driverNotes || '');

  // Check for minibus/sprinter
  const hasMinibusPattern = hasVehicleInfo 
    ? extractMinibusInfo(vehicleInfo || '') 
    : extractMinibusInfo(driverNotes || '');

  // Check for luxury SUV (Range Rover images) - check before regular SUV
  const hasLuxurySUVPattern = hasVehicleInfo 
    ? extractLuxurySUVInfo(vehicleInfo || '') 
    : extractLuxurySUVInfo(driverNotes || '');

  // Check for SUV (priority) - check text patterns regardless of passenger count
  const hasSUVPattern = hasVehicleInfo 
    ? extractSUVInfo(vehicleInfo || '') 
    : extractSUVInfo(driverNotes || '');

  // Check for signature sedan (ultra-luxury cars and specific models) - highest sedan priority
  const hasSignatureSedanPattern = hasVehicleInfo 
    ? extractSignatureSedanInfo(vehicleInfo || '') 
    : extractSignatureSedanInfo(driverNotes || '');

  // Check for premium sedan (luxury cars and specific models)
  const hasPremiumSedanPattern = hasVehicleInfo 
    ? extractPremiumSedanInfo(vehicleInfo || '') 
    : extractPremiumSedanInfo(driverNotes || '');

  // Check for comfort sedan (affordable cars and specific models) - only when explicitly requested
  const hasComfortSedanPattern = hasVehicleInfo 
    ? extractComfortSedanInfo(vehicleInfo || '') 
    : extractComfortSedanInfo(driverNotes || '');

  // Check for sedan patterns (but exclude S-Class which should be premium sedan)
  const hasSedanPattern = hasVehicleInfo 
    ? extractCarInfo(vehicleInfo || '') 
    : extractCarInfo(driverNotes || '');

  // Check for generic car terms (normal, regular, any car) - these should NOT trigger SUV
  const hasGenericCarPattern = hasVehicleInfo 
    ? extractGenericCarInfo(vehicleInfo || '') 
    : extractGenericCarInfo(driverNotes || '');

  // Check if any vehicle info exists (brand/model/type)
  const hasAnyVehicleInfo = hasVehicleInfo || hasSUVPattern || hasLuxurySUVPattern || hasSedanPattern || hasPremiumSedanPattern || hasSignatureSedanPattern || hasComfortSedanPattern || hasMinibusPattern || hasVanPattern;

  // Determine vehicle type: van takes highest priority, then minibus, then luxury SUV, then regular SUV, then signature sedan, then premium sedan, then comfort sedan, then regular sedan
  // Otherwise use passenger count as fallback
  // Default to sedan for < 3 passengers when no vehicle specified
  let vehicleType: VehicleType = null;

  // Check location for overrides
  const isUSCanadaPR = isUSCanadaPuertoRicoTrip(tripDestination);
  const isMiddleEast = isMiddleEastTrip(tripDestination);
  const isEurope = isEuropeTrip(tripDestination);

  // PRIORITY LOGIC:
  // - Larger vehicles (van, minibus, SUV): Always honor if requested, regardless of passenger count (luggage/space needs)
  // - Sedans: Only honor if passenger count fits (typically ≤3-4). If too many passengers, use passenger count logic
  
  if (hasVanPattern) {
    // Van: Always honor if requested (can accommodate luggage even with few passengers)
    vehicleType = 'van';
  } else if (hasMinibusPattern) {
    // Minibus: Always honor if requested (can accommodate luggage even with few passengers)
    vehicleType = 'minibus';
  } else if (hasLuxurySUVPattern) {
    // Luxury SUV: Always honor if requested (can accommodate luggage even with few passengers)
    // Apply location override
    if (isEurope) {
      vehicleType = 'luxury-suv'; // Range Rover
    } else if (isUSCanadaPR || isMiddleEast) {
      vehicleType = 'suv'; // Escalade (override luxury SUV to regular SUV)
    } else {
      vehicleType = 'luxury-suv'; // Range Rover (default)
    }
  } else if (hasSUVPattern) {
    // SUV: Always honor if requested (can accommodate luggage even with few passengers)
    // Apply location override
    if (isEurope) {
      vehicleType = 'luxury-suv'; // Range Rover (override regular SUV to luxury SUV)
    } else if (isUSCanadaPR || isMiddleEast) {
      vehicleType = 'suv'; // Escalade
    } else {
      vehicleType = 'suv'; // Escalade (default)
    }
  } else if (hasSignatureSedanPattern) {
    // Signature Sedan: Only honor if passenger count fits (≤3 passengers)
    // Sedans cannot accommodate more than 3-4 passengers comfortably
    if (normalizedPassengerCount <= 3) {
      vehicleType = 'signature-sedan';
    }
    // If passenger count > 3, fall through to else block (use passenger count logic)
  } else if (hasPremiumSedanPattern) {
    // Premium Sedan: Only honor if passenger count fits (≤3 passengers)
    // Sedans cannot accommodate more than 3-4 passengers comfortably
    if (normalizedPassengerCount <= 3) {
      vehicleType = 'premium-sedan';
    }
    // If passenger count > 3, fall through to else block (use passenger count logic)
  } else if (hasComfortSedanPattern) {
    // Comfort Sedan: Only honor if passenger count fits (≤3 passengers)
    // Sedans cannot accommodate more than 3-4 passengers comfortably
    if (normalizedPassengerCount <= 3) {
      vehicleType = 'comfort-sedan';
    }
    // If passenger count > 3, fall through to else block (use passenger count logic)
  } else if (hasSedanPattern) {
    // Regular Sedan: Only honor if passenger count fits (≤3 passengers)
    // Sedans cannot accommodate more than 3-4 passengers comfortably
    if (normalizedPassengerCount <= 3) {
      vehicleType = 'sedan';
    }
    // If passenger count > 3, fall through to else block (use passenger count logic)
  } else {
    // Fallback to passenger count with location-based logic
    if (normalizedPassengerCount >= 7) {
      vehicleType = 'minibus';
    } else if (normalizedPassengerCount >= 3 && normalizedPassengerCount <= 6) {
      // For 3-6 passengers: check location and explicit SUV requests
      // If generic car terms (normal, regular, any car), don't use SUV/Escalade
      // These will trigger a different vehicle image (not yet uploaded)
      if (hasGenericCarPattern) {
        // For now, use sedan - will be replaced with new vehicle image later
        vehicleType = 'sedan';
      }
      // If explicitly requesting luxury SUV, apply location override
      else if (hasLuxurySUVPattern) {
        if (isEurope) {
          vehicleType = 'luxury-suv'; // Range Rover
        } else if (isUSCanadaPR || isMiddleEast) {
          vehicleType = 'suv'; // Escalade
        } else {
          vehicleType = 'luxury-suv'; // Range Rover (default)
        }
      }
      // If explicitly requesting regular SUV, apply location override
      else if (hasSUVPattern) {
        if (isEurope) {
          vehicleType = 'luxury-suv'; // Range Rover
        } else if (isUSCanadaPR || isMiddleEast) {
          vehicleType = 'suv'; // Escalade
        } else {
          vehicleType = 'suv'; // Escalade (default)
        }
      } 
      // LOCATION-BASED OVERRIDES: Escalade for US/Canada/Middle East, Range Rover for Europe
      else if (isUSCanadaPR || isMiddleEast) {
        vehicleType = 'suv'; // Escalade
      } 
      else if (isEurope) {
        vehicleType = 'luxury-suv'; // Range Rover
      }
      // If NOT in US/Canada/PR/Middle East/Europe, default to van
      else {
        vehicleType = 'van';
      }
    } else if (normalizedPassengerCount >= 1 && normalizedPassengerCount <= 3) {
      // For 1-3 passengers: only show comfort sedan if explicitly requested
      // Otherwise default to Business Sedan (E-Class)
      if (hasComfortSedanPattern) {
        vehicleType = 'comfort-sedan';
      } else {
        vehicleType = 'sedan';
      }
    }
  }

  // LOCATION-BASED OVERRIDES: Apply after all other logic for fallback cases
  // For 3-6 passengers without explicit vehicle request, apply location-based defaults
  if (!hasAnyVehicleInfo && normalizedPassengerCount >= 3 && normalizedPassengerCount <= 6 && vehicleType === 'van') {
    // Override van to SUV based on location
    if (isEurope) {
      vehicleType = 'luxury-suv'; // Range Rover
    } else if (isUSCanadaPR || isMiddleEast) {
      vehicleType = 'suv'; // Escalade
    }
  }

  // Default to sedan for 1-3 passengers when no vehicle info is provided
  // Also handles the case where both vehicle and passengers are unspecified (defaults to Business Sedan with 1 passenger)
  // Comfort sedan is NEVER a fallback - only shows when explicitly requested
  if (!hasAnyVehicleInfo && normalizedPassengerCount >= 1 && normalizedPassengerCount <= 3 && !hasComfortSedanPattern) {
    vehicleType = 'sedan';
  }

  return vehicleType;
};

