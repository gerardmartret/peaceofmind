/**
 * Vehicle Detection Helpers
 * 
 * Functions to detect vehicle types from text patterns in vehicleInfo and driverNotes.
 * Used to determine which vehicle image and display name to show.
 */

export type VehicleType = 'suv' | 'sedan' | 'premium-sedan' | 'signature-sedan' | 'minibus' | 'van' | null;

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
 */
export const extractSUVInfo = (text: string | null): boolean => {
  if (!text) return false;
  const suvPatterns = [
    /\bSUV\b/i,
    /\b(?:sport\s*utility|sport\s*ute)\b/i,
    /(?:Mercedes|Merc)\s*(?:GLS|GLE|GL|GLC|G[\s-]*Class)/i,
    /BMW\s*(?:X[1-9]|XM)/i,
    /Audi\s*(?:Q[3-9]|Q8)/i,
    /Range\s*Rover/i,
    /Cadillac\s*(?:Escalade|XT[4-6])/i,
    /Lincoln\s*(?:Navigator|Aviator)/i,
    /Lexus\s*(?:LX|GX|RX|NX)/i,
    /Porsche\s*(?:Cayenne|Macan)/i,
    /Volvo\s*(?:XC[4-9][0-9]?)/i,
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
 * Determines vehicle type based on vehicleInfo, driverNotes, and passenger count.
 * Priority: van > minibus > SUV > signature sedan > premium sedan > regular sedan > fallback to passenger count
 */
export const determineVehicleType = (
  vehicleInfo: string | null,
  driverNotes: string | null,
  numberOfPassengers: number
): VehicleType => {
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

  // Check for sedan patterns (but exclude S-Class which should be premium sedan)
  const hasSedanPattern = extractCarInfo(vehicleInfo || '') || extractCarInfo(driverNotes || '');

  // Check if any vehicle info exists (brand/model/type)
  const hasAnyVehicleInfo = !!(vehicleInfo && vehicleInfo.trim()) || hasSUVPattern || hasSedanPattern || hasPremiumSedanPattern || hasSignatureSedanPattern || hasMinibusPattern || hasVanPattern;

  // Determine vehicle type: van takes highest priority, then minibus, then SUV, then signature sedan, then premium sedan, then regular sedan
  // Otherwise use passenger count as fallback
  // Default to sedan for < 3 passengers when no vehicle specified
  let vehicleType: VehicleType = null;

  if (hasVanPattern) {
    vehicleType = 'van';
  } else if (hasMinibusPattern) {
    vehicleType = 'minibus';
  } else if (hasSUVPattern) {
    vehicleType = 'suv';
  } else if (hasSignatureSedanPattern && numberOfPassengers <= 3) {
    vehicleType = 'signature-sedan';
  } else if (hasPremiumSedanPattern && numberOfPassengers <= 3) {
    vehicleType = 'premium-sedan';
  } else if (hasSedanPattern) {
    vehicleType = 'sedan';
  } else {
    // Fallback to passenger count
    if (numberOfPassengers > 7) {
      vehicleType = 'minibus';
    } else if (numberOfPassengers > 3 && numberOfPassengers <= 7) {
      vehicleType = 'suv';
    } else if (numberOfPassengers <= 3) {
      vehicleType = 'sedan';
    }
  }

  // Default to sedan for <= 3 passengers when no vehicle info is provided
  if (!hasAnyVehicleInfo && numberOfPassengers <= 3) {
    vehicleType = 'sedan';
  }

  return vehicleType;
};

