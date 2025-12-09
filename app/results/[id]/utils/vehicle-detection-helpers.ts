/**
 * Vehicle Detection Helpers
 * 
 * Functions to detect vehicle types from text patterns in vehicleInfo and driverNotes.
 * Used to determine which vehicle image and display name to show.
 */

import { isUSCanadaPuertoRicoTrip } from '@/lib/city-helpers';

export type VehicleType = 'suv' | 'sedan' | 'premium-sedan' | 'signature-sedan' | 'minibus' | 'van' | 'comfort-sedan' | null;

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
 * Checks if text contains SUV patterns
 * Only includes full-size/large SUVs - compact and mid-size SUVs are excluded
 */
export const extractSUVInfo = (text: string | null): boolean => {
  if (!text) return false;
  const suvPatterns = [
    /\bSUV\b/i,
    /\b(?:sport\s*utility|sport\s*ute)\b/i,
    // Mercedes - only full-size: GLS, GL, G-Class (removed GLE, GLC)
    /(?:Mercedes|Merc)\s*(?:GLS|GL|G[\s-]*Class)/i,
    // BMW - only large/full-size: X5, X6, X7, X8, X9, XM (removed X1-X4)
    /BMW\s*(?:X[5-9]|XM)/i,
    // Audi - only large/full-size: Q7, Q8 (removed Q3-Q6)
    /Audi\s*(?:Q7|Q8)/i,
    /Range\s*Rover/i,
    /Cadillac\s*(?:Escalade|XT[4-6])/i,
    /Lincoln\s*(?:Navigator|Aviator)/i,
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
    /\b(?:van|v-class|vclass)\b/i,
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

  // Check for van/V-Class first (highest priority)
  const hasVanPattern = extractVanInfo(vehicleInfo || '') || extractVanInfo(driverNotes || '');

  // Check for minibus/sprinter
  const hasMinibusPattern = extractMinibusInfo(vehicleInfo || '') || extractMinibusInfo(driverNotes || '');

  // Check for SUV (priority) - check text patterns regardless of passenger count
  const hasSUVPattern = extractSUVInfo(vehicleInfo || '') || extractSUVInfo(driverNotes || '');

  // Check for signature sedan (ultra-luxury cars and specific models) - highest sedan priority
  const hasSignatureSedanPattern = extractSignatureSedanInfo(vehicleInfo || '') || extractSignatureSedanInfo(driverNotes || '');

  // Check for premium sedan (luxury cars and specific models)
  const hasPremiumSedanPattern = extractPremiumSedanInfo(vehicleInfo || '') || extractPremiumSedanInfo(driverNotes || '');

  // Check for comfort sedan (affordable cars and specific models) - only when explicitly requested
  const hasComfortSedanPattern = extractComfortSedanInfo(vehicleInfo || '') || extractComfortSedanInfo(driverNotes || '');

  // Check for sedan patterns (but exclude S-Class which should be premium sedan)
  const hasSedanPattern = extractCarInfo(vehicleInfo || '') || extractCarInfo(driverNotes || '');

  // Check for generic car terms (normal, regular, any car) - these should NOT trigger SUV
  const hasGenericCarPattern = extractGenericCarInfo(vehicleInfo || '') || extractGenericCarInfo(driverNotes || '');

  // Check if any vehicle info exists (brand/model/type)
  const hasAnyVehicleInfo = hasVehicleInfo || hasSUVPattern || hasSedanPattern || hasPremiumSedanPattern || hasSignatureSedanPattern || hasComfortSedanPattern || hasMinibusPattern || hasVanPattern;

  // Determine vehicle type: van takes highest priority, then minibus, then SUV, then signature sedan, then premium sedan, then comfort sedan, then regular sedan
  // Otherwise use passenger count as fallback
  // Default to sedan for < 3 passengers when no vehicle specified
  let vehicleType: VehicleType = null;

  if (hasVanPattern) {
    vehicleType = 'van';
  } else if (hasMinibusPattern) {
    vehicleType = 'minibus';
  } else if (hasSUVPattern) {
    vehicleType = 'suv';
  } else if (hasSignatureSedanPattern && normalizedPassengerCount <= 3) {
    vehicleType = 'signature-sedan';
  } else if (hasPremiumSedanPattern && normalizedPassengerCount <= 3) {
    vehicleType = 'premium-sedan';
  } else if (hasComfortSedanPattern && normalizedPassengerCount <= 3) {
    // Comfort sedan only shows when explicitly requested (affordable terms or specific models)
    vehicleType = 'comfort-sedan';
  } else if (hasSedanPattern) {
    vehicleType = 'sedan';
  } else {
    // Fallback to passenger count with location-based logic
    if (normalizedPassengerCount >= 7) {
      vehicleType = 'minibus';
    } else if (normalizedPassengerCount >= 3 && normalizedPassengerCount <= 6) {
      // For 3-6 passengers: check location and explicit SUV requests
      const isUSCanadaPR = isUSCanadaPuertoRicoTrip(tripDestination);
      
      // If generic car terms (normal, regular, any car), don't use SUV/Escalade
      // These will trigger a different vehicle image (not yet uploaded)
      if (hasGenericCarPattern) {
        // For now, use sedan - will be replaced with new vehicle image later
        vehicleType = 'sedan';
      }
      // If explicitly requesting SUV, use SUV regardless of location
      else if (hasSUVPattern) {
        vehicleType = 'suv';
      } 
      // If in US, Canada, or Puerto Rico, default to SUV
      else if (isUSCanadaPR) {
        vehicleType = 'suv';
      } 
      // If NOT in US/Canada/PR, default to van (unless explicitly requesting SUV)
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

  // Default to sedan for 1-3 passengers when no vehicle info is provided
  // Also handles the case where both vehicle and passengers are unspecified (defaults to Business Sedan with 1 passenger)
  // Comfort sedan is NEVER a fallback - only shows when explicitly requested
  if (!hasAnyVehicleInfo && normalizedPassengerCount >= 1 && normalizedPassengerCount <= 3 && !hasComfortSedanPattern) {
    vehicleType = 'sedan';
  }

  return vehicleType;
};

