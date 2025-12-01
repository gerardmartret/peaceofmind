/**
 * Drivania API Client Library
 * Handles authentication and API calls to Drivania booking API
 */

const BASE_URL = process.env.DRIVANIA_API_BASE_URL || 'https://publicapi.drivania.com';
const USERNAME = process.env.DRIVANIA_API_USERNAME;
const PASSWORD = process.env.DRIVANIA_API_PASSWORD;

// Token cache
let cachedToken: string | null = null;
let tokenExpiresAt: Date | null = null;

interface LoginResponse {
  token: string;
  token_ttl: string;
  username: string;
}

interface Stop {
  name: string;
  latitude: number;
  longitude: number;
  location_type: 'airport' | 'hotel' | 'train-station' | 'other';
  datetime: string | null;
}

interface QuoteRequest {
  service_type: 'one-way' | 'hourly';
  pickup: Stop;
  dropoff: Stop;
  passengers_number: number;
  client_code?: string;
}

interface QuoteResponse {
  service_id: string;
  distance: {
    quantity: number;
    uom: string;
  } | null;
  drive_time: string | null;
  currency_code: string | null;
  created_at: string;
  quotes: {
    vehicles: Array<{
      vehicle_id: string;
      expires_at: string;
      vehicle_type: string;
      level_of_service: string;
      vehicle_examples: string;
      max_seating_capacity: number;
      max_cargo_capacity: number;
      sale_price: {
        price: number;
        discount_rate: number;
        vat_rate: number;
      };
      extra_hour: number;
      pickup_instructions: string;
      cancellation_policy: string;
      vehicle_image: string;
      unavailable_reason?: string;
    }>;
    unavailable_reason?: string;
  };
  expiration: string;
}

/**
 * Authenticate with Drivania API and get access token
 */
async function login(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && tokenExpiresAt && new Date() < tokenExpiresAt) {
    return cachedToken;
  }

  if (!USERNAME || !PASSWORD) {
    throw new Error('Drivania API credentials not configured. Please set DRIVANIA_API_USERNAME and DRIVANIA_API_PASSWORD environment variables.');
  }

  try {
    const response = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: USERNAME,
        password: PASSWORD,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Provide user-friendly error messages
      let errorMessage = errorData.message;
      if (response.status === 503) {
        errorMessage = 'Drivania API is temporarily unavailable. Please try again in a few moments.';
      } else if (response.status === 401) {
        errorMessage = 'Invalid Drivania API credentials. Please check your username and password.';
      } else if (response.status === 429) {
        errorMessage = 'Too many requests to Drivania API. Please wait a moment before trying again.';
      } else if (!errorMessage) {
        errorMessage = `Login failed with status ${response.status}`;
      }
      
      throw new Error(errorMessage);
    }

    const data: LoginResponse = await response.json();

    // Cache the token
    cachedToken = data.token;
    // Parse expiration time and set cache expiry 1 minute before actual expiry
    const expiresAt = new Date(data.token_ttl);
    tokenExpiresAt = new Date(expiresAt.getTime() - 60000); // 1 minute buffer

    return data.token;
  } catch (error) {
    console.error('❌ Drivania API login error:', error);
    throw error;
  }
}

/**
 * Get authenticated token (login if needed)
 */
async function getAuthToken(): Promise<string> {
  return await login();
}

/**
 * Request a quote from Drivania API
 */
export async function requestQuote(
  quoteRequest: QuoteRequest
): Promise<QuoteResponse> {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${BASE_URL}/quote-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(quoteRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 401) {
        // Token expired, clear cache and retry once
        cachedToken = null;
        tokenExpiresAt = null;
        const newToken = await getAuthToken();
        
        const retryResponse = await fetch(`${BASE_URL}/quote-requests`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${newToken}`,
          },
          body: JSON.stringify(quoteRequest),
        });

        if (!retryResponse.ok) {
          const retryErrorData = await retryResponse.json().catch(() => ({}));
          
          // Provide user-friendly error messages
          let errorMessage = retryErrorData.message;
          if (retryResponse.status === 503) {
            errorMessage = 'Drivania API is temporarily unavailable. Please try again in a few moments.';
          } else if (retryResponse.status === 429) {
            errorMessage = 'Too many requests to Drivania API. Please wait a moment before trying again.';
          } else if (!errorMessage) {
            errorMessage = `Quote request failed with status ${retryResponse.status}`;
          }
          
          throw new Error(errorMessage);
        }

        return await retryResponse.json();
      }

      // Provide user-friendly error messages for other status codes
      let errorMessage = errorData.message;
      if (response.status === 503) {
        errorMessage = 'Drivania API is temporarily unavailable. Please try again in a few moments.';
      } else if (response.status === 429) {
        errorMessage = 'Too many requests to Drivania API. Please wait a moment before trying again.';
      } else if (response.status === 400) {
        errorMessage = errorData.message || 'Invalid request. Please check your trip details.';
      } else if (!errorMessage) {
        errorMessage = `Quote request failed with status ${response.status}`;
      }

      throw new Error(errorMessage);
    }

    const data: QuoteResponse = await response.json();
    return data;
  } catch (error) {
    console.error('❌ Drivania API quote request error:', error);
    throw error;
  }
}

/**
 * Clear cached token (useful for testing or forced re-authentication)
 */
export function clearTokenCache(): void {
  cachedToken = null;
  tokenExpiresAt = null;
}

/**
 * Format phone number for Drivania API
 * Must contain country code, numbers only (no spaces, dashes, or other characters)
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-numeric characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Remove leading + if present (we'll add country code if needed)
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  
  // If phone doesn't start with country code (1-3 digits), add default +1 (US)
  // This is a fallback - ideally the phone should already have country code
  if (cleaned.length > 0 && !/^[1-9]\d{6,}$/.test(cleaned)) {
    // If it looks like a local number (7-10 digits), assume US (+1)
    if (/^\d{7,10}$/.test(cleaned)) {
      cleaned = '1' + cleaned;
    }
  }
  
  return cleaned;
}

/**
 * Extract FBO/ICAO code from airport location name
 * Looks for 4-letter uppercase codes (ICAO format)
 */
export function extractFBOCode(locationName: string): string | null {
  if (!locationName) return null;
  
  // Look for 4-letter uppercase codes (ICAO format: [A-Z]{4})
  const icaoPattern = /\b([A-Z]{4})\b/g;
  const matches = locationName.match(icaoPattern);
  
  if (matches && matches.length > 0) {
    // Return the first 4-letter code found
    return matches[0];
  }
  
  // Common airport code mappings (IATA to ICAO)
  const airportCodeMap: Record<string, string> = {
    'BCN': 'LEBL', // Barcelona
    'LHR': 'EGLL', // Heathrow
    'LGW': 'EGKK', // Gatwick
    'STN': 'EGSS', // Stansted
    'LTN': 'EGGW', // Luton
    'JFK': 'KJFK', // JFK
    'LGA': 'KLGA', // LaGuardia
    'EWR': 'KEWR', // Newark
    'CDG': 'LFPG', // Charles de Gaulle
    'ORY': 'LFPO', // Orly
    'FRA': 'EDDF', // Frankfurt
    'SIN': 'WSSS', // Singapore
    'NRT': 'RJAA', // Narita
    'HND': 'RJTT', // Haneda
    'BOS': 'KBOS', // Boston
    'ZRH': 'LSZH', // Zurich
  };
  
  // Check for IATA codes in the location name
  const upperName = locationName.toUpperCase();
  for (const [iata, icao] of Object.entries(airportCodeMap)) {
    if (upperName.includes(iata)) {
      return icao;
    }
  }
  
  return null;
}

interface ServiceRequest {
  service_id: string;
  vehicle_id: string;
  lead_passenger: {
    name: string;
    phone_number: string;
    email: string | null;
  };
  phone_number: string;
  comments: string;
  childseats?: number;
  boosters?: number;
  client_reference?: string;
  purchase_order?: string;
  contacts: Array<{
    name: string;
    email: string | null;
    phone_number: string | null;
    recipient: 'to' | 'cc' | 'bcc';
    permissions: Array<{
      permission_name: string;
      email: boolean;
      sms: boolean;
    }>;
  }>;
  arrival_flight_info?: {
    fbo_code: string;
    transportation_number: string | null;
  };
  departure_flight_info?: {
    fbo_code: string;
    transportation_number: string | null;
  };
  fbo_code?: string;
}

interface ServiceResponse {
  service_reference: string;
  status: string;
}

/**
 * Create a service in Drivania API with confirm=false
 */
export async function createService(
  serviceRequest: ServiceRequest,
  confirm: boolean = false
): Promise<ServiceResponse> {
  try {
    const token = await getAuthToken();

    const url = `${BASE_URL}/services${confirm ? '' : '?confirm=false'}`;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📤 [Drivania API] Creating service');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('URL:', url);
    console.log('Confirm:', confirm);
    console.log('REQUEST BODY:');
    console.log(JSON.stringify(serviceRequest, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(serviceRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 401) {
        // Token expired, clear cache and retry once
        cachedToken = null;
        tokenExpiresAt = null;
        const newToken = await getAuthToken();
        
        const retryResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${newToken}`,
          },
          body: JSON.stringify(serviceRequest),
        });

        if (!retryResponse.ok) {
          const retryErrorData = await retryResponse.json().catch(() => ({}));
          
          let errorMessage = retryErrorData.message;
          if (retryResponse.status === 503) {
            errorMessage = 'Drivania API is temporarily unavailable. Please try again in a few moments.';
          } else if (retryResponse.status === 429) {
            errorMessage = 'Too many requests to Drivania API. Please wait a moment before trying again.';
          } else if (retryResponse.status === 400) {
            errorMessage = retryErrorData.message || 'Invalid service request. Please check your booking details.';
          } else if (!errorMessage) {
            errorMessage = `Service creation failed with status ${retryResponse.status}`;
          }
          
          throw new Error(errorMessage);
        }

        const data: ServiceResponse = await retryResponse.json();
        console.log('✅ [Drivania API] Service created successfully:', data);
        return data;
      }

      // Provide user-friendly error messages for other status codes
      let errorMessage = errorData.message;
      if (response.status === 503) {
        errorMessage = 'Drivania API is temporarily unavailable. Please try again in a few moments.';
      } else if (response.status === 429) {
        errorMessage = 'Too many requests to Drivania API. Please wait a moment before trying again.';
      } else if (response.status === 400) {
        errorMessage = errorData.message || 'Invalid service request. Please check your booking details.';
      } else if (!errorMessage) {
        errorMessage = `Service creation failed with status ${response.status}`;
      }

      throw new Error(errorMessage);
    }

    const data: ServiceResponse = await response.json();
    console.log('✅ [Drivania API] Service created successfully:', data);
    return data;
  } catch (error) {
    console.error('❌ Drivania API service creation error:', error);
    throw error;
  }
}

