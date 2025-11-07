'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import GoogleTripMap from '@/components/GoogleTripMap';
import TripRiskBreakdown from '@/components/TripRiskBreakdown';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Car } from 'lucide-react';
import { getTrafficPredictions } from '@/lib/google-traffic-predictions';
import { searchNearbyCafes } from '@/lib/google-cafes';
import { searchEmergencyServices } from '@/lib/google-emergency-services';
import { useGoogleMaps } from '@/hooks/useGoogleMaps';
import { validateBusinessEmail } from '@/lib/email-validation';

// Helper function to convert numbers to letters (1 -> A, 2 -> B, etc.)
const numberToLetter = (num: number): string => {
  return String.fromCharCode(64 + num); // 65 is 'A' in ASCII
};

// Helper function to extract business/place name and format address display
const formatLocationDisplay = (fullAddress: string): { businessName: string; restOfAddress: string } => {
  if (!fullAddress) return { businessName: '', restOfAddress: '' };
  
  const parts = fullAddress.split(',').map(p => p.trim());
  
  if (parts.length === 0) return { businessName: fullAddress, restOfAddress: '' };
  if (parts.length === 1) return { businessName: parts[0], restOfAddress: '' };
  
  // Special handling for airports - look for airport name in the address
  const lowerAddress = fullAddress.toLowerCase();
  const airportKeywords = [
    { keyword: 'heathrow', fullName: 'Heathrow Airport' },
    { keyword: 'gatwick', fullName: 'Gatwick Airport' },
    { keyword: 'stansted', fullName: 'Stansted Airport' },
    { keyword: 'luton', fullName: 'Luton Airport' },
    { keyword: 'london city airport', fullName: 'London City Airport' },
  ];
  
  for (const airport of airportKeywords) {
    if (lowerAddress.includes(airport.keyword)) {
      // If it's a terminal, show "Airport Name - Terminal X"
      const terminalMatch = parts[0].match(/terminal\s+\d+/i);
      if (terminalMatch) {
        const businessName = `${airport.fullName} - ${terminalMatch[0]}`;
        const restOfAddress = parts.slice(1).join(', ');
        return { businessName, restOfAddress };
      }
      // Otherwise, use the airport name
      const businessName = airport.fullName;
      const restOfAddress = parts.join(', ');
      return { businessName, restOfAddress };
    }
  }
  
  // For non-airports, first part is typically the business/place name
  const businessName = parts[0];
  // Rest is the detailed address
  const restOfAddress = parts.slice(1).join(', ');
  
  return { businessName, restOfAddress };
};

interface CrimeData {
  district: string;
  coordinates: { lat: number; lng: number };
  crimes: any[];
  summary: {
    totalCrimes: number;
    topCategories: Array<{ category: string; count: number; percentage: number }>;
    byOutcome: Record<string, number>;
    month: string;
  };
  safetyScore: number;
}

interface DisruptionData {
  district: string;
  timeframe: string;
  isAreaFiltered: boolean;
  disruptions: any[];
  analysis: {
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    active: number;
    upcoming: number;
  };
}

interface WeatherData {
  district: string;
  coordinates: { lat: number; lng: number };
  forecast: Array<{
    date: string;
    maxTemp: number;
    minTemp: number;
    precipitation: number;
    precipitationProb: number;
    weatherCode: number;
    weatherDescription: string;
    windSpeed: number;
  }>;
  summary: {
    avgMaxTemp: number;
    avgMinTemp: number;
    totalPrecipitation: number;
    rainyDays: number;
    maxWindSpeed: number;
  };
}

interface EventData {
  location: string;
  coordinates: { lat: number; lng: number };
  date: string;
  events: Array<{
    title: string;
    description: string;
    date?: string;
    severity: 'high' | 'medium' | 'low';
    type: 'strike' | 'protest' | 'festival' | 'construction' | 'other';
  }>;
  summary: {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    highSeverity: number;
  };
}

interface ParkingData {
  location: string;
  coordinates: { lat: number; lng: number };
  carParks: Array<{
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    distance: number;
    totalSpaces?: number;
    operatingHours?: string;
    facilities: string[];
    type: string;
  }>;
  cpzInfo: {
    inCPZ: boolean;
    zone?: string;
    zoneName?: string;
    borough?: string;
    operatingHours?: string;
    operatingDays?: string;
    restrictions?: string;
    chargeInfo?: string;
  };
  parkingRiskScore: number;
  summary: {
    totalNearby: number;
    averageDistance: number;
    hasStationParking: boolean;
    cpzWarning: boolean;
  };
}

interface CafeData {
  location: string;
  coordinates: { lat: number; lng: number };
  cafes: Array<{
    id: string;
    name: string;
    address: string;
    rating: number;
    userRatingsTotal: number;
    priceLevel: number;
    distance?: number;
    lat: number;
    lng: number;
    types: string[];
    businessStatus?: string;
  }>;
  summary: {
    total: number;
    averageRating: number;
    averageDistance: number;
  };
}

interface EmergencyServicesData {
  location: string;
  coordinates: { lat: number; lng: number };
  policeStation?: {
    id: string;
    name: string;
    address: string;
    distance: number;
    lat: number;
    lng: number;
    type: 'police';
  };
  hospital?: {
    id: string;
    name: string;
    address: string;
    distance: number;
    lat: number;
    lng: number;
    type: 'hospital';
  };
}

interface CombinedData {
  crime: CrimeData;
  disruptions: DisruptionData;
  weather: WeatherData;
  events: EventData;
  parking: ParkingData;
  cafes: CafeData;
  emergencyServices?: EmergencyServicesData;
}

interface TripData {
  tripDate: string;
  userEmail: string;
  locations: Array<{
    id: string;
    name: string;
    displayName?: string; // Custom user-defined name
    lat: number;
    lng: number;
    time: string;
  }>;
  tripResults: Array<{
    locationId: string;
    locationName: string;
    fullAddress?: string;
    time: string;
    data: CombinedData;
  }>;
  trafficPredictions: any;
  executiveReport: any;
  passengerCount?: number;
  tripDestination?: string;
  passengerNames?: string[];
  password?: string | null;
  status?: string;
}

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;
  const { user, isAuthenticated, signUp } = useAuth();
  const { isLoaded: isGoogleMapsLoaded } = useGoogleMaps();
  const [tripData, setTripData] = useState<TripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [ownershipChecked, setOwnershipChecked] = useState<boolean>(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editingLocationName, setEditingLocationName] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [locationDisplayNames, setLocationDisplayNames] = useState<{[key: string]: string}>({});
  const [expandedLocations, setExpandedLocations] = useState<{[key: string]: boolean}>({});
  const [expandedRoutes, setExpandedRoutes] = useState<{[key: string]: boolean}>({});
  const [driverNotes, setDriverNotes] = useState<string>('');
  const [leadPassengerName, setLeadPassengerName] = useState<string>('');
  const [vehicleInfo, setVehicleInfo] = useState<string>('');
  const [passengerCount, setPassengerCount] = useState<number>(1);
  const [tripDestination, setTripDestination] = useState<string>('');
  const [passengerNames, setPassengerNames] = useState<string[]>([]);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [editedDriverNotes, setEditedDriverNotes] = useState<string>('');
  const [showNotesSuccess, setShowNotesSuccess] = useState(false);
  
  // Update functionality state
  const [updateText, setUpdateText] = useState<string>('');
  const [extractedUpdates, setExtractedUpdates] = useState<any>(null);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [comparisonDiff, setComparisonDiff] = useState<any>(null);
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);
  
  // Enhanced error tracking with step information
  const [updateProgress, setUpdateProgress] = useState<{
    step: string;
    error: string | null;
    canRetry: boolean;
  }>({
    step: '',
    error: null,
    canRetry: false,
  });
  
  // Live Trip functionality state
  const [isLiveMode, setIsLiveMode] = useState<boolean>(false);
  const [activeLocationIndex, setActiveLocationIndex] = useState<number | null>(null);
  const [liveTripInterval, setLiveTripInterval] = useState<NodeJS.Timeout | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  
  // Password protection state
  const [isPasswordProtected, setIsPasswordProtected] = useState<boolean>(false);
  const [isPasswordVerified, setIsPasswordVerified] = useState<boolean>(true); // Default to true to avoid showing form during loading
  const [showPasswordGate, setShowPasswordGate] = useState<boolean>(false); // Explicitly control password gate visibility
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [verifyingPassword, setVerifyingPassword] = useState<boolean>(false);
  
  // Trip status state
  const [tripStatus, setTripStatus] = useState<string>('not confirmed');
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [sendingStatusNotification, setSendingStatusNotification] = useState<boolean>(false);
  
  // Quotes state
  const [quotes, setQuotes] = useState<Array<{
    id: string;
    email: string;
    price: number;
    currency: string;
    created_at: string;
  }>>([]);
  const [loadingQuotes, setLoadingQuotes] = useState<boolean>(false);
  const [quoteEmail, setQuoteEmail] = useState<string>('');
  const [quotePrice, setQuotePrice] = useState<string>('');
  const [quoteCurrency, setQuoteCurrency] = useState<string>('USD');
  const [quoteEmailError, setQuoteEmailError] = useState<string | null>(null);
  const [quotePriceError, setQuotePriceError] = useState<string | null>(null);
  const [submittingQuote, setSubmittingQuote] = useState<boolean>(false);
  const [quoteSuccess, setQuoteSuccess] = useState<boolean>(false);
  const [quoteSuccessMessage, setQuoteSuccessMessage] = useState<string>('Quote submitted successfully!');
  
  // Driver state
  const [driverEmail, setDriverEmail] = useState<string | null>(null);
  const [manualDriverEmail, setManualDriverEmail] = useState<string>('');
  const [manualDriverError, setManualDriverError] = useState<string | null>(null);
  const [settingDriver, setSettingDriver] = useState<boolean>(false);
  const [driverSuggestions, setDriverSuggestions] = useState<string[]>([]);
  const [showDriverSuggestions, setShowDriverSuggestions] = useState<boolean>(false);
  const [filteredDriverSuggestions, setFilteredDriverSuggestions] = useState<string[]>([]);
  const [notifyingDriver, setNotifyingDriver] = useState<boolean>(false);
  const [notificationSuccess, setNotificationSuccess] = useState<boolean>(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  
  // Quote request state (for inviting drivers to quote)
  const [allocateDriverEmail, setAllocateDriverEmail] = useState<string>('');
  const [allocateDriverEmailError, setAllocateDriverEmailError] = useState<string | null>(null);
  const [sendingQuoteRequest, setSendingQuoteRequest] = useState<boolean>(false);
  const [quoteRequestSuccess, setQuoteRequestSuccess] = useState<string | null>(null);
  const [quoteRequestError, setQuoteRequestError] = useState<string | null>(null);
  const [sentDriverEmails, setSentDriverEmails] = useState<Array<{
    email: string;
    sentAt: string;
  }>>([]);
  
  // Guest signup state
  const [isGuestCreator, setIsGuestCreator] = useState<boolean>(false);
  const [guestSignupPassword, setGuestSignupPassword] = useState<string>('');
  const [guestSignupError, setGuestSignupError] = useState<string | null>(null);
  const [guestSignupLoading, setGuestSignupLoading] = useState<boolean>(false);
  const [guestSignupSuccess, setGuestSignupSuccess] = useState<boolean>(false);

  // Update current time when in live mode
  useEffect(() => {
    if (isLiveMode) {
      const timeInterval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000); // Update every second

      return () => clearInterval(timeInterval);
    }
  }, [isLiveMode]);

  // Function to format stored time - returns time as-is without any timezone conversion
  const getLondonLocalTime = (timeString: string): string => {
    if (!timeString) return 'N/A';
    
    // Simply return the time string as formatted HH:MM
    // Parse the time string (e.g., "18:35" or "18")
    const timeParts = timeString.split(':');
    const hours = parseInt(timeParts[0]) || 0;
    const minutes = parseInt(timeParts[1]) || 0;
    
    // Format as HH:MM (pad with zeros if needed)
    const formattedHours = hours.toString().padStart(2, '0');
    const formattedMinutes = minutes.toString().padStart(2, '0');
    
    return `${formattedHours}:${formattedMinutes}`;
  };


  // Function to extract flight numbers from driver notes
  const extractFlightNumbers = (notes: string): {[locationName: string]: string[]} => {
    if (!notes) return {};
    
    console.log('🔍 [DEBUG] extractFlightNumbers - Input notes:', notes);
    
    const flightMap: {[locationName: string]: string[]} = {};
    
    // Common flight number patterns - more comprehensive
    const flightPatterns = [
      /\b([A-Z]{2,3}\s*\d{3,4})\b/g, // BA123, AA1234, etc.
      /\b(flight\s*([A-Z]{2,3}\s*\d{3,4}))/gi, // "flight BA123"
      /\b([A-Z]{2,3}\s*\d{3,4})\s*(?:arrives?|departs?|lands?|takes\s*off)/gi, // "BA123 arrives"
      /\b([A-Z]{2,3}\s*\d{3,4})\s*(?:at|from|to)\s*(?:heathrow|gatwick|stansted|luton|city|airport)/gi, // "BA123 at Heathrow"
      /\b(heathrow|gatwick|stansted|luton|city|airport).*?([A-Z]{2,3}\s*\d{3,4})/gi, // "Heathrow BA123"
    ];
    
    // Common airport keywords
    const airportKeywords = [
      'heathrow', 'gatwick', 'stansted', 'luton', 'city', 'airport',
      'terminal', 'arrivals', 'departures', 'lhr', 'lgw', 'stn', 'ltn'
    ];
    
    // Split notes into sentences and look for flight numbers near airport mentions
    const sentences = notes.split(/[.!?]+/);
    console.log('🔍 [DEBUG] extractFlightNumbers - Sentences:', sentences);
    
    sentences.forEach(sentence => {
      const lowerSentence = sentence.toLowerCase();
      console.log('🔍 [DEBUG] extractFlightNumbers - Checking sentence:', sentence);
      
      // Check if sentence mentions an airport
      const mentionedAirport = airportKeywords.find(keyword => 
        lowerSentence.includes(keyword)
      );
      
      console.log('🔍 [DEBUG] extractFlightNumbers - Mentioned airport:', mentionedAirport);
      
      if (mentionedAirport) {
        // Look for flight numbers in this sentence
        flightPatterns.forEach(pattern => {
          const matches = sentence.match(pattern);
          if (matches) {
            console.log('🔍 [DEBUG] extractFlightNumbers - Found flight matches:', matches);
            matches.forEach(match => {
              // Clean up the flight number
              const flightNumber = match.replace(/flight\s*/gi, '').trim();
              if (flightNumber) {
                console.log('🔍 [DEBUG] extractFlightNumbers - Cleaned flight number:', flightNumber);
                // Determine airport name based on context
                let airportName = 'Airport';
                if (lowerSentence.includes('heathrow') || lowerSentence.includes('lhr')) {
                  airportName = 'Heathrow Airport';
                } else if (lowerSentence.includes('gatwick') || lowerSentence.includes('lgw')) {
                  airportName = 'Gatwick Airport';
                } else if (lowerSentence.includes('stansted') || lowerSentence.includes('stn')) {
                  airportName = 'Stansted Airport';
                } else if (lowerSentence.includes('luton') || lowerSentence.includes('ltn')) {
                  airportName = 'Luton Airport';
                } else if (lowerSentence.includes('city')) {
                  airportName = 'London City Airport';
                }
                
                console.log('🔍 [DEBUG] extractFlightNumbers - Airport name:', airportName);
                
                if (!flightMap[airportName]) {
                  flightMap[airportName] = [];
                }
                if (!flightMap[airportName].includes(flightNumber)) {
                  flightMap[airportName].push(flightNumber);
                }
              }
            });
          }
        });
      }
    });
    
    console.log('🔍 [DEBUG] extractFlightNumbers - Final flight map:', flightMap);
    return flightMap;
  };

  // Function to extract service introduction from driver notes
  const extractServiceIntroduction = (notes: string): string => {
    if (!notes) {
      return 'Executive transportation service';
    }
    
    // Extract key operational details
    const serviceType = notes.toLowerCase().includes('full day') ? 'Full day hourly-based journey' : 
                       notes.toLowerCase().includes('hourly') ? 'Hourly-based journey' :
                       notes.toLowerCase().includes('chauffeur') ? 'Chauffeur service' :
                       'Executive transportation service';
    
    // Extract client name
    const nameMatch = notes.match(/\b(Mr\.|Mrs\.|Ms\.|Dr\.|Sir|Lady)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/);
    const clientName = nameMatch ? `${nameMatch[1]} ${nameMatch[2]}` : 'Client';
    
    // Extract location context
    const locationContext = notes.toLowerCase().includes('london') ? 'in London' : 'in the specified area';
    
    // Count stops
    const stopCount = locations?.length || 0;
    const stopText = stopCount === 1 ? 'stop' : 'stops';
    
    // Extract start and end times from locations
    let timeInfo = '';
    if (locations && locations.length > 0) {
      const startTime = locations[0]?.time ? getLondonLocalTime(locations[0].time) : '';
      const endTime = locations[locations.length - 1]?.time ? getLondonLocalTime(locations[locations.length - 1].time) : '';
      
      if (startTime && endTime && startTime !== endTime) {
        timeInfo = ` starting at ${startTime} and finishing at ${endTime}`;
      } else if (startTime) {
        timeInfo = ` starting at ${startTime}`;
      }
    }
    
    return `${serviceType} for ${clientName} with ${stopCount} ${stopText} ${locationContext}${timeInfo}`;
  };

  // Function to extract car information from driver notes
  const extractCarInfo = (notes: string): string | null => {
    if (!notes) {
      console.log('🚗 [CAR DEBUG] No driver notes provided');
      return null;
    }
    
    console.log('🚗 [CAR DEBUG] ===== CAR EXTRACTION START =====');
    console.log('🚗 [CAR DEBUG] Input driver notes:', notes);
    console.log('🚗 [CAR DEBUG] Notes length:', notes.length);
    
    // Enhanced car patterns - prioritize full specifications (brand + model)
    const carPatterns = [
      // Color + Brand + Model (highest priority)
      /\b(black|white|silver|grey|gray|blue|red|green|gold|champagne)\s+(mercedes|bmw|audi|lexus|tesla|jaguar|bentley|rolls\s*royce|porsche|ferrari|lamborghini|maserati|aston\s*martin)\s+(s-class|e-class|c-class|a-class|x5|x3|x1|x7|a4|a6|a8|q5|q7|q8|model\s*s|model\s*x|es|ls|gs|rx|gx|lx|continental|flying\s*spur|ghost|phantom|911|cayenne|macan|boxster|carrera|488|f8|huracan|aventador|granturismo|quattroporte|db11|vantage|rapide)\b/gi,
      // Brand + Model (high priority)
      /\b(mercedes|bmw|audi|lexus|tesla|jaguar|bentley|rolls\s*royce|porsche|ferrari|lamborghini|maserati|aston\s*martin)\s+(s-class|e-class|c-class|a-class|x5|x3|x1|x7|a4|a6|a8|q5|q7|q8|model\s*s|model\s*x|es|ls|gs|rx|gx|lx|continental|flying\s*spur|ghost|phantom|911|cayenne|macan|boxster|carrera|488|f8|huracan|aventador|granturismo|quattroporte|db11|vantage|rapide)\b/gi,
      // Color + Brand (medium priority)
      /\b(black|white|silver|grey|gray|blue|red|green|gold|champagne)\s+(mercedes|bmw|audi|lexus|tesla|jaguar|bentley|rolls\s*royce|porsche|ferrari|lamborghini|maserati|aston\s*martin)\b/gi,
      // Brand only (lowest priority)
      /\b(mercedes|bmw|audi|lexus|tesla|jaguar|bentley|rolls\s*royce|porsche|ferrari|lamborghini|maserati|aston\s*martin)\b/gi,
      // Vehicle type
      /\b(executive|luxury|premium|vip|chauffeur|limousine|sedan|saloon|suv|coupe|convertible|estate|wagon)\s+(car|vehicle|auto)\b/gi,
      // Requirements
      /\b(car|vehicle|auto)\s+(must\s*be|should\s*be|needs\s*to\s*be|required)\s+(mercedes|bmw|audi|lexus|tesla|jaguar|bentley|rolls\s*royce|porsche|ferrari|lamborghini|maserati|aston\s*martin)\b/gi,
      // Color + Type
      /\b(black|white|silver|grey|gray|blue|red|green|gold|champagne)\s+(executive|luxury|premium|vip|chauffeur|limousine|sedan|saloon|suv|coupe|convertible|estate|wagon)\s+(car|vehicle|auto)\b/gi,
      // Simple mentions
      /\b(mercedes|bmw|audi|lexus|tesla|jaguar|bentley|rolls\s*royce|porsche|ferrari|lamborghini|maserati|aston\s*martin)\s+(car|vehicle|auto)\b/gi,
      // "black car", "luxury vehicle" etc
      /\b(black|white|silver|grey|gray|blue|red|green|gold|champagne)\s+(car|vehicle|auto)\b/gi
    ];
    
    console.log('🚗 [CAR DEBUG] Total patterns to check:', carPatterns.length);
    
    // Split notes into sentences and look for car mentions
    const sentences = notes.split(/[.!?]+/).filter(s => s.trim().length > 0);
    console.log('🚗 [CAR DEBUG] Sentences found:', sentences.length);
    console.log('🚗 [CAR DEBUG] Sentences:', sentences);
    
    // Track the best match (most complete specification)
    let bestMatch = null;
    let bestMatchScore = 0;
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      console.log(`🚗 [CAR DEBUG] Checking sentence ${i + 1}:`, sentence);
      
      for (let j = 0; j < carPatterns.length; j++) {
        const pattern = carPatterns[j];
        console.log(`🚗 [CAR DEBUG] Testing pattern ${j + 1}:`, pattern);
        
        const matches = sentence.match(pattern);
        if (matches && matches.length > 0) {
          console.log('🚗 [CAR DEBUG] ✅ MATCH FOUND!');
          console.log('🚗 [CAR DEBUG] Matches:', matches);
          console.log('🚗 [CAR DEBUG] Pattern that matched:', pattern);
          
          // Calculate match score (higher score = more complete specification)
          let matchScore = 0;
          const match = matches[0].trim().toLowerCase();
          
          // Score based on pattern priority (earlier patterns = higher priority)
          matchScore += (carPatterns.length - j) * 10;
          
          // Bonus points for brand + model combinations
          if (match.includes('s-class') || match.includes('e-class') || match.includes('a-class') || 
              match.includes('a4') || match.includes('a6') || match.includes('a8') ||
              match.includes('x5') || match.includes('x3') || match.includes('x1') ||
              match.includes('q5') || match.includes('q7') || match.includes('q8')) {
            matchScore += 20;
          }
          
          // Bonus points for color specification
          if (match.includes('black') || match.includes('white') || match.includes('silver') ||
              match.includes('grey') || match.includes('gray') || match.includes('blue') ||
              match.includes('red') || match.includes('green') || match.includes('gold') ||
              match.includes('champagne')) {
            matchScore += 10;
          }
          
          console.log('🚗 [CAR DEBUG] Match score:', matchScore);
          
          // Keep the best match
          if (matchScore > bestMatchScore) {
            bestMatch = matches[0].trim();
            bestMatchScore = matchScore;
            console.log('🚗 [CAR DEBUG] New best match:', bestMatch);
          }
        }
      }
    }
    
    // Process the best match if found
    if (bestMatch) {
      console.log('🚗 [CAR DEBUG] ✅ BEST MATCH SELECTED!');
      console.log('🚗 [CAR DEBUG] Best match:', bestMatch);
      console.log('🚗 [CAR DEBUG] Best match score:', bestMatchScore);
      
      // Clean up and format the car mention
      let carMention = bestMatch;
      console.log('🚗 [CAR DEBUG] Raw best match:', carMention);
      
      // Capitalize first letter of each word
      carMention = carMention.replace(/\b\w/g, l => l.toUpperCase());
      console.log('🚗 [CAR DEBUG] After capitalization:', carMention);
      
      // Clean up common formatting issues
      carMention = carMention.replace(/\s+/g, ' ');
      carMention = carMention.replace(/\bCar\b/g, 'car');
      carMention = carMention.replace(/\bVehicle\b/g, 'vehicle');
      carMention = carMention.replace(/\bAuto\b/g, 'auto');
      
      // Format brand + model combinations properly
      carMention = carMention.replace(/\bMercedes\s+S-Class\b/gi, 'Mercedes S-Class');
      carMention = carMention.replace(/\bMercedes\s+E-Class\b/gi, 'Mercedes E-Class');
      carMention = carMention.replace(/\bMercedes\s+C-Class\b/gi, 'Mercedes C-Class');
      carMention = carMention.replace(/\bMercedes\s+A-Class\b/gi, 'Mercedes A-Class');
      carMention = carMention.replace(/\bAudi\s+A4\b/gi, 'Audi A4');
      carMention = carMention.replace(/\bAudi\s+A6\b/gi, 'Audi A6');
      carMention = carMention.replace(/\bAudi\s+A8\b/gi, 'Audi A8');
      carMention = carMention.replace(/\bBMW\s+X5\b/gi, 'BMW X5');
      carMention = carMention.replace(/\bBMW\s+X3\b/gi, 'BMW X3');
      carMention = carMention.replace(/\bBMW\s+X1\b/gi, 'BMW X1');
      carMention = carMention.replace(/\bAudi\s+Q5\b/gi, 'Audi Q5');
      carMention = carMention.replace(/\bAudi\s+Q7\b/gi, 'Audi Q7');
      carMention = carMention.replace(/\bAudi\s+Q8\b/gi, 'Audi Q8');
      
      console.log('🚗 [CAR DEBUG] Final formatted car mention:', carMention);
      console.log('🚗 [CAR DEBUG] ===== CAR EXTRACTION SUCCESS =====');
      return carMention;
    }
    
    console.log('🚗 [CAR DEBUG] ❌ No car information found in any sentence');
    console.log('🚗 [CAR DEBUG] ===== CAR EXTRACTION FAILED =====');
    return null;
  };

  const handleEditLocationName = (locationId: string, currentName: string) => {
    setEditingLocationId(locationId);
    // Get the current display name or use the first part of the full address
    const currentDisplayName = locationDisplayNames[locationId] || currentName.split(',')[0];
    setEditingLocationName(currentDisplayName);
    
    // Select all text in the input field after it's rendered
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.select();
      }
    }, 0);
  };

  const handleSaveLocationName = async (locationId: string) => {
    // Security check: Only owners can edit location names
    if (!isOwner) {
      console.error('❌ Unauthorized: Only trip owners can edit location names');
      setEditingLocationId(null);
      setEditingLocationName('');
      return;
    }

    if (!editingLocationName.trim() || !tripData) {
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

      // Save to database
      const { error: updateError } = await supabase
        .from('trips')
        .update({ locations: updatedLocations })
        .eq('id', tripId);

      if (updateError) {
        console.error('Error saving location name:', updateError);
        setEditingLocationId(null);
        setEditingLocationName('');
        return;
      }

      // Update local state
      setTripData({
        ...tripData,
        locations: updatedLocations
      });

      setLocationDisplayNames(prev => ({
        ...prev,
        [locationId]: editingLocationName.trim()
      }));

      setEditingLocationId(null);
      setEditingLocationName('');
    } catch (error) {
      console.error('Error saving location name:', error);
      setEditingLocationId(null);
      setEditingLocationName('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, locationId: string) => {
    if (e.key === 'Enter') {
      handleSaveLocationName(locationId);
    } else if (e.key === 'Escape') {
      setEditingLocationId(null);
      setEditingLocationName('');
    }
  };

  const toggleLocationExpansion = (locationId: string) => {
    setExpandedLocations(prev => ({
      ...prev,
      [locationId]: !prev[locationId]
    }));
  };

  const toggleRouteExpansion = (routeId: string) => {
    setExpandedRoutes(prev => ({
      ...prev,
      [routeId]: !prev[routeId]
    }));
  };

  // Live Trip helper functions - returns current local time without timezone conversion
  const getCurrentTripTime = (): Date => {
    // Simply return the current local time
    return new Date();
  };

  const findClosestLocation = (): number => {
    if (!tripData?.locations || tripData.locations.length === 0) {
      return 0;
    }

    const currentTime = getCurrentTripTime();
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    let closestIndex = 0;
    let smallestDiff = Infinity;

    tripData.locations.forEach((location, index) => {
      const locationTime = parseInt(location.time) || 0;
      const locationTimeInMinutes = locationTime * 60;
      const diff = Math.abs(currentTimeInMinutes - locationTimeInMinutes);
      
      if (diff < smallestDiff) {
        smallestDiff = diff;
        closestIndex = index;
      }
    });

    return closestIndex;
  };

  // Check if trip is within 1 hour of starting - simplified without timezone conversions
  const isTripWithinOneHour = (): boolean => {
    if (!tripData?.tripDate || !tripData?.locations || tripData.locations.length === 0) {
      return false;
    }

    const now = new Date();
    const tripDateTime = new Date(tripData.tripDate);
    const oneHourBefore = new Date(tripDateTime.getTime() - 60 * 60 * 1000);
    
    return now >= oneHourBefore;
  };


  const startLiveTrip = () => {
    if (!tripData?.locations) return;

    const closestIndex = findClosestLocation();
    setActiveLocationIndex(closestIndex);
    setIsLiveMode(true);

    // Set up interval to update active location every minute
    const interval = setInterval(() => {
      const newClosestIndex = findClosestLocation();
      if (newClosestIndex !== activeLocationIndex) {
        setActiveLocationIndex(newClosestIndex);
      }
    }, 60000); // Update every minute

    setLiveTripInterval(interval);
  };

  const stopLiveTrip = () => {

    setIsLiveMode(false);
    setActiveLocationIndex(null);
    if (liveTripInterval) {
      clearInterval(liveTripInterval);
      setLiveTripInterval(null);
    }
  };

  const handleSaveNotes = async () => {
    if (!tripId) return;
    
    // Security check: Only owners can save notes
    if (!isOwner) {
      console.error('❌ Unauthorized: Only trip owners can edit driver notes');
      return;
    }

    try {
      setIsSavingNotes(true);
      
      console.log('Saving notes with values:', {
        editedDriverNotes,
        leadPassengerName,
        vehicleInfo,
        passengerCount,
        tripDestination,
        passengerNames,
        tripId
      });
      
      const updateData: any = {
        trip_notes: editedDriverNotes
      };
      
      // Only include new fields if they have values
      if (leadPassengerName) {
        updateData.lead_passenger_name = leadPassengerName;
      }
      if (vehicleInfo) {
        updateData.vehicle = vehicleInfo;
      }
      if (passengerCount && passengerCount > 0) {
        updateData.passenger_count = passengerCount;
      }
      if (tripDestination) {
        updateData.trip_destination = tripDestination;
      }
      // Note: passenger_names column doesn't exist in database
      // Passenger names are still used for display but not stored in DB
      
      console.log('Update data:', updateData);
      
      // First check if the trip exists
      const { data: existingTrip, error: fetchError } = await supabase
        .from('trips')
        .select('id')
        .eq('id', tripId)
        .single();
        
      if (fetchError) {
        console.error('Error fetching trip:', fetchError);
        return;
      }
      
      if (!existingTrip) {
        console.error('Trip not found with ID:', tripId);
        return;
      }
      
      const { error: updateError } = await supabase
        .from('trips')
        .update(updateData)
        .eq('id', tripId);

      if (updateError) {
        console.error('Error saving notes:', updateError);
        console.error('Update data:', updateData);
        console.error('Trip ID:', tripId);
        return;
      }

      // Update the local state with the saved notes
      setDriverNotes(editedDriverNotes);
      
      setIsEditingNotes(false);
      setShowNotesSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setShowNotesSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error saving notes:', error);
    } finally {
      setIsSavingNotes(false);
    }
  };

  useEffect(() => {
    async function loadTripFromDatabase() {
      if (!tripId) {
        console.log('⚠️ No trip ID provided');
        router.push('/');
        return;
      }

      try {
        console.log(`📡 Loading trip from database: ${tripId}`);
        
        const { data, error: fetchError } = await supabase
          .from('trips')
          .select('*')
          .eq('id', tripId)
          .single();

        if (fetchError) {
          console.error('❌ Error loading trip:', fetchError);
          setError('Trip not found');
          setLoading(false);
          return;
        }

        if (!data) {
          console.log('⚠️ Trip not found in database');
          setError('Trip not found');
          setLoading(false);
          return;
        }

        console.log('✅ Trip loaded from database');
        
        // Check ownership: if user is authenticated and their ID matches the trip's user_id
        const tripUserId = data.user_id;
        const currentUserId = user?.id;
        
        // Use local variable to determine ownership
        const userIsOwner = isAuthenticated && currentUserId && tripUserId === currentUserId;
        
        if (userIsOwner) {
          setIsOwner(true);
          console.log('🔐 User is the owner of this trip - editing enabled');
        } else {
          setIsOwner(false);
          console.log('👁️ User is NOT the owner - read-only mode');
        }
        
        // Check if user is guest creator (for signup CTA)
        if (!isAuthenticated && !tripUserId && typeof window !== 'undefined') {
          const createdTripId = sessionStorage.getItem('guestCreatedTripId');
          if (createdTripId === tripId) {
            setIsGuestCreator(true);
            console.log('👤 Guest user created this trip - showing signup CTA');
          }
        }
        
        // Transform database data to match expected TripData format
        // Ensure traffic_predictions has correct structure with success flag
        let trafficPredictionsFormatted: any = null;
        const rawTrafficPredictions = data.traffic_predictions as any;
        
        if (rawTrafficPredictions) {
          // Check if it already has the correct structure
          if (rawTrafficPredictions.success !== undefined && Array.isArray(rawTrafficPredictions.data)) {
            // Already in correct format
            trafficPredictionsFormatted = rawTrafficPredictions;
          } else if (Array.isArray(rawTrafficPredictions)) {
            // Legacy format - array of route data
            trafficPredictionsFormatted = {
              success: true,
              data: rawTrafficPredictions,
            };
          } else if (rawTrafficPredictions.data && Array.isArray(rawTrafficPredictions.data)) {
            // Has data array but missing success flag or other fields
            trafficPredictionsFormatted = {
              success: rawTrafficPredictions.success !== false, // Default to true if not explicitly false
              data: rawTrafficPredictions.data,
              totalDistance: rawTrafficPredictions.totalDistance || '0 km',
              totalMinutes: rawTrafficPredictions.totalMinutes || 0,
              totalMinutesNoTraffic: rawTrafficPredictions.totalMinutesNoTraffic || 0,
            };
          } else {
            // Invalid format - set to null to show "Calculating..."
            console.warn('⚠️ Invalid traffic_predictions format:', rawTrafficPredictions);
            trafficPredictionsFormatted = null;
          }
        }

        const tripData: TripData = {
          tripDate: data.trip_date,
          userEmail: data.user_email,
          locations: data.locations as any,
          tripResults: data.trip_results as any,
          trafficPredictions: trafficPredictionsFormatted,
          executiveReport: data.executive_report as any,
          passengerCount: data.passenger_count || 1,
          tripDestination: data.trip_destination || '',
          passengerNames: [], // passenger_names column doesn't exist in DB
          password: data.password || null,
          status: data.status || 'not confirmed',
        };

        setTripData(tripData);
        setDriverNotes(data.trip_notes || '');
        setEditedDriverNotes(data.trip_notes || '');
        setLeadPassengerName(data.lead_passenger_name || '');
        setVehicleInfo(data.vehicle || '');
        setPassengerCount(data.passenger_count || 1);
        setTripDestination(data.trip_destination || '');
        setPassengerNames([]); // passenger_names column doesn't exist in DB, set empty array
        setCurrentVersion(data.version || 1); // Load current version
        setTripStatus(data.status || 'not confirmed'); // Load trip status
        setDriverEmail(data.driver || null); // Load driver email
        
        // Check if password protection is enabled
        const hasPassword = !!data.password;
        setIsPasswordProtected(hasPassword);
        
        // Populate location display names from database
        const displayNames: {[key: string]: string} = {};
        tripData.locations.forEach((loc: any) => {
          // Use the location name (which is now the purpose) as the display name
          if (loc.name) {
            displayNames[loc.id] = loc.name;
          }
        });
        setLocationDisplayNames(displayNames);
        
        // Determine if password gate should be shown
        // Use local userIsOwner variable to make decision before state updates
        const shouldShowPasswordGate = hasPassword && !userIsOwner;
        
        if (shouldShowPasswordGate) {
          setIsPasswordVerified(false);
          setShowPasswordGate(true);
          console.log('🔒 Report is password protected - password required');
        } else {
          setIsPasswordVerified(true);
          setShowPasswordGate(false);
          console.log('🔓 Report access granted');
        }
        
        // Mark ownership as checked and loading complete - MUST be last to prevent UI glitches
        setOwnershipChecked(true);
        setLoading(false);
      } catch (err) {
        console.error('❌ Unexpected error:', err);
        setError('Failed to load trip');
        setLoading(false);
      }
    }
    
    loadTripFromDatabase();
  }, [tripId, router, user, isAuthenticated]);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Cleanup live trip interval on unmount
  useEffect(() => {
    return () => {
      if (liveTripInterval) {
        clearInterval(liveTripInterval);
      }
    };
  }, [liveTripInterval]);

  const handleGuestSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuestSignupError(null);
    
    // Validation
    if (!guestSignupPassword || guestSignupPassword.length < 6) {
      setGuestSignupError('Password must be at least 6 characters');
      return;
    }
    
    if (!tripData?.userEmail) {
      setGuestSignupError('Email not found. Please try again.');
      return;
    }
    
    setGuestSignupLoading(true);
    
    try {
      // Create auth user with email and password
      const { error: signUpError } = await signUp(tripData.userEmail, guestSignupPassword);
      
      if (signUpError) {
        // Handle specific errors
        if (signUpError.message.toLowerCase().includes('already registered') || 
            signUpError.message.toLowerCase().includes('already exists')) {
          setGuestSignupError(`This email already has an account. Please login instead.`);
        } else {
          setGuestSignupError(signUpError.message);
        }
        setGuestSignupLoading(false);
        return;
      }
      
      // Wait a moment for auth state to update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get the session to get user ID
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user?.id) {
        // Update ALL trips with this email to link to new user
        const { error: updateError } = await supabase
          .from('trips')
          .update({ user_id: session.user.id })
          .eq('user_email', tripData.userEmail)
          .is('user_id', null);
        
        if (updateError) {
          console.error('Error linking trips to user:', updateError);
        } else {
          console.log('✅ All guest trips linked to new account');
        }
        
        // Clear sessionStorage
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('guestCreatedTripId');
        }
        
        // Show success and refresh page
        setGuestSignupSuccess(true);
        setGuestSignupError(null);
        
        // Refresh the page after 2 seconds to show owner UI
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setGuestSignupError('Something went wrong. Please try logging in.');
      }
    } catch (err) {
      console.error('Unexpected signup error:', err);
      setGuestSignupError('An unexpected error occurred. Please try again.');
    } finally {
      setGuestSignupLoading(false);
    }
  };

  const handlePlanNewTrip = () => {
    // Redirect to home for new trip
    router.push('/');
  };

  const handleStatusToggle = () => {
    if (!tripId || !isOwner || updatingStatus) return;
    
    const newStatus = tripStatus === 'confirmed' ? 'not confirmed' : 'confirmed';
    
    // Show modal to confirm status change
    setPendingStatus(newStatus);
    setShowStatusModal(true);
  };

  const handleConfirmStatusChange = async (notifyDriver: boolean = false) => {
    if (!tripId || !isOwner || !pendingStatus) return;
    
    setUpdatingStatus(true);

    try {
      const response = await fetch('/api/update-trip-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: tripId,
          status: pendingStatus,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setTripStatus(pendingStatus);
        console.log(`✅ Trip status updated to: ${pendingStatus}`);
        
        // Send notification if requested and driver is set
        if (notifyDriver && driverEmail) {
          await sendStatusChangeNotification();
        }
        
        // Close modal
        setShowStatusModal(false);
        setPendingStatus(null);
      } else {
        console.error('❌ Failed to update status:', result.error);
      }
    } catch (err) {
      console.error('❌ Error updating trip status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const sendStatusChangeNotification = async () => {
    if (!tripId || !driverEmail || !pendingStatus) return;
    
    setSendingStatusNotification(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('❌ No session found');
        return;
      }

      const response = await fetch('/api/notify-status-change', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          tripId: tripId,
          newStatus: pendingStatus,
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log(`✅ Status change notification sent to ${driverEmail}`);
      } else {
        console.error('❌ Failed to send status notification:', result.error);
      }
    } catch (err) {
      console.error('❌ Error sending status notification:', err);
    } finally {
      setSendingStatusNotification(false);
    }
  };

  const fetchQuotes = useCallback(async () => {
    if (!tripId || !isOwner) return;
    
    setLoadingQuotes(true);
    try {
      // Get the current session to send auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('❌ No session found');
        setLoadingQuotes(false);
        return;
      }

      const response = await fetch('/api/get-quotes', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          tripId: tripId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setQuotes(result.quotes || []);
        console.log(`✅ Fetched ${result.quotes?.length || 0} quotes`);
      } else {
        console.error('❌ Failed to fetch quotes:', result.error);
      }
    } catch (err) {
      console.error('❌ Error fetching quotes:', err);
    } finally {
      setLoadingQuotes(false);
    }
  }, [tripId, isOwner]);

  // Fetch quotes when page loads (for owners only)
  useEffect(() => {
    if (isOwner && tripId && !loading) {
      fetchQuotes();
    }
  }, [isOwner, tripId, loading, fetchQuotes]);

  // Fetch driver suggestions when page loads (for owners only)
  useEffect(() => {
    async function fetchDriverSuggestions() {
      if (!isOwner) return;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.error('❌ No session found');
          return;
        }

        const response = await fetch('/api/get-user-drivers', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        const result = await response.json();

        if (result.success) {
          setDriverSuggestions(result.drivers || []);
          setFilteredDriverSuggestions(result.drivers || []);
          console.log(`✅ Loaded ${result.drivers?.length || 0} driver suggestions`);
        } else {
          console.error('❌ Failed to fetch driver suggestions:', result.error);
        }
      } catch (err) {
        console.error('❌ Error fetching driver suggestions:', err);
      }
    }

    if (isOwner && !loading) {
      fetchDriverSuggestions();
    }
  }, [isOwner, loading]);

  const handleSetDriver = async (email: string) => {
    if (!tripId || !isOwner || settingDriver) return;
    
    setSettingDriver(true);
    setManualDriverError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('❌ No session found');
        setManualDriverError('Please log in to set driver');
        setSettingDriver(false);
        return;
      }

      const response = await fetch('/api/set-driver', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          tripId: tripId,
          driverEmail: email,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setDriverEmail(email.toLowerCase());
        console.log(`✅ Driver set to: ${email}`);
        setManualDriverEmail('');
        setShowDriverSuggestions(false);
      } else {
        setManualDriverError(result.error || 'Failed to set driver');
      }
    } catch (err) {
      console.error('❌ Error setting driver:', err);
      setManualDriverError('An error occurred while setting driver');
    } finally {
      setSettingDriver(false);
    }
  };

  const handleManualDriverInputChange = (value: string) => {
    setManualDriverEmail(value);
    setManualDriverError(null);
    
    // Filter suggestions based on input
    if (value.trim().length > 0) {
      const filtered = driverSuggestions.filter(driver =>
        driver.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredDriverSuggestions(filtered);
    } else {
      setFilteredDriverSuggestions(driverSuggestions);
    }
  };

  const handleManualDriverInputFocus = () => {
    setShowDriverSuggestions(true);
    if (manualDriverEmail.trim().length === 0) {
      setFilteredDriverSuggestions(driverSuggestions);
    }
  };

  const handleSelectDriverSuggestion = (driver: string) => {
    setManualDriverEmail(driver);
    setShowDriverSuggestions(false);
    handleSetDriver(driver);
  };

  const handleNotifyDriver = async () => {
    if (!tripId || !isOwner || !driverEmail || notifyingDriver) return;
    
    setNotifyingDriver(true);
    setNotificationError(null);
    setNotificationSuccess(false);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('❌ No session found');
        setNotificationError('Please log in to notify driver');
        setNotifyingDriver(false);
        return;
      }

      const response = await fetch('/api/notify-driver', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          tripId: tripId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setNotificationSuccess(true);
        console.log(`✅ Driver notified: ${driverEmail}`);
        // Hide success message after 5 seconds
        setTimeout(() => setNotificationSuccess(false), 5000);
      } else {
        setNotificationError(result.error || 'Failed to notify driver');
      }
    } catch (err) {
      console.error('❌ Error notifying driver:', err);
      setNotificationError('An error occurred while notifying driver');
    } finally {
      setNotifyingDriver(false);
    }
  };

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset errors and success
    setQuoteEmailError(null);
    setQuotePriceError(null);
    setQuoteSuccess(false);

    // Validate email
    const emailValidation = validateBusinessEmail(quoteEmail.trim());
    if (!emailValidation.isValid) {
      setQuoteEmailError(emailValidation.error || 'Invalid email address');
      return;
    }

    // Validate price
    const priceNum = parseFloat(quotePrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setQuotePriceError('Please enter a valid price greater than 0');
      return;
    }

    setSubmittingQuote(true);

    try {
      const response = await fetch('/api/submit-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: tripId,
          email: quoteEmail.trim(),
          price: priceNum,
          currency: quoteCurrency,
        }),
      });

      const result = await response.json();

      if (result.success) {
        const action = result.isUpdate ? 'updated' : 'submitted';
        console.log(`✅ Quote ${action} successfully`);
        setQuoteSuccessMessage(
          result.isUpdate 
            ? 'Quote updated successfully! The trip owner will see your updated offer.'
            : 'Quote submitted successfully! The trip owner will review your offer.'
        );
        setQuoteSuccess(true);
        // Clear form
        setQuoteEmail('');
        setQuotePrice('');
        setQuoteCurrency('USD');
        // Hide success message after 5 seconds
        setTimeout(() => setQuoteSuccess(false), 5000);
      } else {
        setQuoteEmailError(result.error || 'Failed to submit quote');
      }
    } catch (err) {
      console.error('❌ Error submitting quote:', err);
      setQuoteEmailError('Failed to submit quote. Please try again.');
    } finally {
      setSubmittingQuote(false);
    }
  };

  const handleSendQuoteRequest = async () => {
    if (!tripId || !isOwner || !allocateDriverEmail || sendingQuoteRequest) return;
    
    // Reset errors and success
    setAllocateDriverEmailError(null);
    setQuoteRequestError(null);
    setQuoteRequestSuccess(null);

    // Validate email
    const emailValidation = validateBusinessEmail(allocateDriverEmail.trim());
    if (!emailValidation.isValid) {
      setAllocateDriverEmailError(emailValidation.error || 'Invalid email address');
      return;
    }

    // Check if already sent to this email
    const normalizedEmail = allocateDriverEmail.trim().toLowerCase();
    if (sentDriverEmails.some(sent => sent.email.toLowerCase() === normalizedEmail)) {
      setAllocateDriverEmailError('Quote request already sent to this email');
      return;
    }

    setSendingQuoteRequest(true);

    try {
      // Get the current session to send auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setQuoteRequestError('You must be logged in to send quote requests');
        setSendingQuoteRequest(false);
        return;
      }

      const response = await fetch('/api/request-quote', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          tripId: tripId,
          driverEmail: allocateDriverEmail.trim(),
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Add to sent emails list
        setSentDriverEmails([
          ...sentDriverEmails,
          {
            email: allocateDriverEmail.trim(),
            sentAt: new Date().toISOString(),
          }
        ]);
        
        setQuoteRequestSuccess(`Quote request sent to ${allocateDriverEmail.trim()}`);
        // Clear form
        setAllocateDriverEmail('');
        // Hide success message after 5 seconds
        setTimeout(() => setQuoteRequestSuccess(null), 5000);
      } else {
        setQuoteRequestError(result.error || 'Failed to send quote request');
      }
    } catch (err) {
      console.error('❌ Error sending quote request:', err);
      setQuoteRequestError('Failed to send quote request. Please try again.');
    } finally {
      setSendingQuoteRequest(false);
    }
  };

  const handleModifyTrip = () => {
    // For now, just redirect to home
    // Future: could pre-fill form with current trip data
    router.push('/');
  };

  const getSafetyColor = (score: number) => {
    if (score >= 80) return 'text-[#3ea34b]';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 40) return 'text-[#db7304]';
    return 'text-[#9e201b]';
  };

  // Helper function to parse notes into bullet points
  const parseNotesToBullets = (notes: string | null): string[] => {
    if (!notes) return [];
    return notes
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && (line.startsWith('-') || line.startsWith('•') || line.match(/^\d+\./)))
      .map(line => line.replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, '').trim());
  };

  // Helper function to merge and deduplicate notes
  const mergeNotes = (existingNotes: string, newNotes: string): string => {
    const existingBullets = parseNotesToBullets(existingNotes);
    const newBullets = parseNotesToBullets(newNotes);
    
    // Simple deduplication: check if a bullet point is similar to an existing one
    const isSimilar = (bullet1: string, bullet2: string): boolean => {
      const normalize = (str: string) => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
      const norm1 = normalize(bullet1);
      const norm2 = normalize(bullet2);
      
      // Exact match or one contains the other (for fuzzy matching)
      if (norm1 === norm2) return true;
      if (norm1.length > 20 && norm2.length > 20) {
        const words1 = norm1.split(/\s+/);
        const words2 = norm2.split(/\s+/);
        const commonWords = words1.filter(w => words2.includes(w));
        const similarity = commonWords.length / Math.max(words1.length, words2.length);
        return similarity > 0.7; // 70% similarity threshold
      }
      return false;
    };

    // Keep existing notes first
    const merged: string[] = [...existingBullets];
    
    // Add new notes that aren't similar to existing ones
    for (const newBullet of newBullets) {
      const isDuplicate = merged.some(existing => isSimilar(existing, newBullet));
      if (!isDuplicate) {
        merged.push(newBullet);
      }
    }

    // Format as bullet points
    return merged.map(bullet => `- ${bullet}`).join('\n');
  };

  // Compare extracted updates with current state
  const compareTripData = (extracted: any, current: TripData) => {
    const diff: any = {
      tripDateChanged: false,
      locations: [] as any[],
      passengerInfoChanged: false,
      vehicleInfoChanged: false,
      notesChanged: false,
      mergedNotes: '',
    };

    // Compare trip date
    if (extracted.date && extracted.date !== current.tripDate) {
      diff.tripDateChanged = true;
    }

    // Compare locations by index
    const extractedLocations = extracted.locations || [];
    const currentLocations = current.locations || [];
    const maxLength = Math.max(extractedLocations.length, currentLocations.length);

    for (let i = 0; i < maxLength; i++) {
      const extractedLoc = extractedLocations[i];
      const currentLoc = currentLocations[i];

      if (!extractedLoc && currentLoc) {
        // Location removed
        diff.locations.push({
          type: 'removed',
          index: i,
          oldAddress: currentLoc.name || '',
          oldTime: currentLoc.time || '',
          oldPurpose: currentLoc.name || '',
        });
      } else if (extractedLoc && !currentLoc) {
        // Location added
        diff.locations.push({
          type: 'added',
          index: i,
          newAddress: extractedLoc.formattedAddress || extractedLoc.location || '',
          newTime: extractedLoc.time || '',
          newPurpose: extractedLoc.purpose || '',
        });
      } else if (extractedLoc && currentLoc) {
        // Check for modifications
        const addressChanged = (extractedLoc.formattedAddress || extractedLoc.location || '') !== (currentLoc.name || '');
        const timeChanged = (extractedLoc.time || '') !== (currentLoc.time || '');
        const purposeChanged = (extractedLoc.purpose || '') !== (currentLoc.name || '');

        if (addressChanged || timeChanged || purposeChanged) {
          diff.locations.push({
            type: 'modified',
            index: i,
            addressChanged,
            timeChanged,
            purposeChanged,
            oldAddress: currentLoc.name || '',
            oldTime: currentLoc.time || '',
            oldPurpose: currentLoc.name || '',
            newAddress: extractedLoc.formattedAddress || extractedLoc.location || '',
            newTime: extractedLoc.time || '',
            newPurpose: extractedLoc.purpose || '',
          });
        }
      }
    }

    // Compare passenger info
    const extractedPassengerName = extracted.leadPassengerName || extracted.passengerNames?.join(', ') || '';
    if (extractedPassengerName && extractedPassengerName !== leadPassengerName) {
      diff.passengerInfoChanged = true;
    }

    // Compare vehicle info
    if (extracted.vehicleInfo && extracted.vehicleInfo !== vehicleInfo) {
      diff.vehicleInfoChanged = true;
    }

    // Merge notes
    const newNotes = extracted.driverNotes || '';
    if (newNotes && newNotes.trim()) {
      diff.notesChanged = true;
      diff.mergedNotes = mergeNotes(driverNotes, newNotes);
    }

    return diff;
  };

  // Merge trip updates
  const mergeTripUpdates = (extracted: any, current: TripData) => {
    const mergedLocations: any[] = [];
    const extractedLocations = extracted.locations || [];
    const currentLocations = current.locations || [];
    const maxLength = Math.max(extractedLocations.length, currentLocations.length);

    // Merge locations by index
    for (let i = 0; i < maxLength; i++) {
      const extractedLoc = extractedLocations[i];
      const currentLoc = currentLocations[i];

      if (extractedLoc) {
        // Use extracted location, but preserve existing coordinates if address matches
        const newLoc: any = {
          id: currentLoc?.id || (i + 1).toString(),
          name: extractedLoc.purpose || extractedLoc.location || '',
          time: extractedLoc.time || '',
          lat: extractedLoc.lat || currentLoc?.lat || 0,
          lng: extractedLoc.lng || currentLoc?.lng || 0,
          fullAddress: extractedLoc.formattedAddress || extractedLoc.location || '',
          purpose: extractedLoc.purpose || '',
        };

        // If address seems the same, preserve coordinates
        if (currentLoc && (
          (extractedLoc.formattedAddress || extractedLoc.location || '').toLowerCase() === 
          (currentLoc.name || '').toLowerCase()
        )) {
          newLoc.lat = currentLoc.lat;
          newLoc.lng = currentLoc.lng;
        }

        mergedLocations.push(newLoc);
      }
      // If no extracted location at this index, skip it (removed)
    }

    // Merge notes
    const newNotes = extracted.driverNotes || '';
    const mergedNotes = newNotes && newNotes.trim() ? mergeNotes(driverNotes, newNotes) : driverNotes;

    // Merge passenger info
    const mergedPassengerName = extracted.leadPassengerName || 
      (extracted.passengerNames?.length > 0 ? extracted.passengerNames.join(', ') : leadPassengerName);

    return {
      locations: mergedLocations,
      tripDate: extracted.date || current.tripDate,
      passengerName: mergedPassengerName,
      vehicleInfo: extracted.vehicleInfo || vehicleInfo,
      passengerCount: extracted.passengerCount || passengerCount,
      tripDestination: extracted.tripDestination || tripDestination,
      notes: mergedNotes,
      passengerNames: extracted.passengerNames || [],
    };
  };

  // Extract updates handler
  const handleExtractUpdates = async () => {
    // Security check: Only owners can extract updates
    if (!isOwner) {
      console.error('❌ Unauthorized: Only trip owners can extract updates');
      setError('Only trip owners can update trip information');
      return;
    }

    if (!updateText.trim()) return;

    setIsExtracting(true);
    setError(null);
    setUpdateProgress({ step: '', error: null, canRetry: false });

    try {
      // Step 1: Extract updates from text
      setUpdateProgress({ step: 'Extracting trip data', error: null, canRetry: false });
      console.log('🔄 Step 1: Extracting updates from text...');
      
      const extractResponse = await fetch('/api/extract-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: updateText }),
      });

      const extractedData = await extractResponse.json();

      if (!extractedData.success) {
        const errorMsg = extractedData.error || 'Could not understand the update text';
        console.error('❌ Extraction failed:', errorMsg);
        setError(errorMsg); // Keep old error state as fallback
        setUpdateProgress({
          step: 'Extraction',
          error: 'Could not understand the update. Try rephrasing or breaking it into smaller pieces. For example: "Change pickup time to 3pm" or "Add stop at The Ritz Hotel"',
          canRetry: true,
        });
        return;
      }

      console.log('✅ Step 1 complete: Extracted data successfully');
      setExtractedUpdates(extractedData);
      
      // Step 2: Intelligently compare with current state using AI
      if (tripData) {
        setUpdateProgress({ step: 'Comparing with current trip', error: null, canRetry: false });
        console.log('🔄 Step 2: Comparing extracted updates with current trip...');
        
        const compareResponse = await fetch('/api/compare-trip-updates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            extractedData,
            currentTripData: {
              tripDate: tripData.tripDate,
              leadPassengerName: leadPassengerName,
              vehicle: vehicleInfo,
              passengerCount: passengerCount,
              tripDestination: tripDestination,
              tripNotes: driverNotes,
              locations: tripData.locations.map((loc: any, idx: number) => ({
                id: loc.id,
                name: loc.name,
                address: loc.name, // Use name as address for comparison
                time: loc.time,
                purpose: loc.name, // Purpose is stored in name field
                lat: loc.lat,
                lng: loc.lng,
                role: idx === 0 ? 'pickup' : (idx === tripData.locations.length - 1 ? 'drop-off' : 'stop'), // Add role for AI to understand
              })),
            },
          }),
        });

        const compareResult = await compareResponse.json();

        if (!compareResult.success) {
          const errorMsg = compareResult.error || 'Failed to compare updates';
          console.error('❌ Comparison failed:', errorMsg);
          setError(errorMsg); // Keep old error state as fallback
          setUpdateProgress({
            step: 'Comparison',
            error: 'Could not match updates with current trip. This usually happens when location names are ambiguous. Try being more specific (e.g., "Change pickup at Gatwick to 3pm" instead of "Change time to 3pm")',
            canRetry: true,
          });
          return;
        }

        console.log('✅ Step 2 complete: Comparison successful');
        
        // Transform AI comparison result to our diff format
        setUpdateProgress({ step: 'Preparing preview', error: null, canRetry: false });
        console.log('🔄 Step 3: Transforming comparison to preview format...');
        
        const diff = transformComparisonToDiff(compareResult.comparison, extractedData);
        setComparisonDiff(diff);
        setShowPreview(true);
        
        console.log('✅ All steps complete: Preview ready');
        setUpdateProgress({ step: '', error: null, canRetry: false }); // Clear progress on success
      }
    } catch (err) {
      console.error('❌ Unexpected error during update extraction:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage); // Keep old error state as fallback
      setUpdateProgress({
        step: updateProgress.step || 'Processing update',
        error: `Something went wrong during ${updateProgress.step || 'the update process'}. ${errorMessage}`,
        canRetry: true,
      });
    } finally {
      setIsExtracting(false);
    }
  };

  // Transform AI comparison result to our diff format for UI display
  const transformComparisonToDiff = (comparison: any, extractedData: any) => {
    const diff: any = {
      tripDateChanged: comparison.tripDateChanged || false,
      locations: [],
      passengerInfoChanged: comparison.passengerInfoChanged || false,
      vehicleInfoChanged: comparison.vehicleInfoChanged || false,
      passengerCountChanged: comparison.passengerCountChanged || false,
      tripDestinationChanged: comparison.tripDestinationChanged || false,
      notesChanged: comparison.notesChanged || false,
      mergedNotes: comparison.mergedNotes || '',
      finalLocations: [], // Store final merged locations for regeneration
    };

    // Transform location changes - first collect all, then sort by index for final locations
    const finalLocationsMap: { [key: number]: any } = {};
    
    // If comparison doesn't return locations or they're all unchanged, ensure all current locations are preserved
    if (!comparison.locations || !Array.isArray(comparison.locations) || comparison.locations.length === 0) {
      // No location changes - preserve all current locations as unchanged
      if (tripData?.locations && tripData.locations.length > 0) {
        tripData.locations.forEach((loc: any, idx: number) => {
          finalLocationsMap[idx] = {
            id: loc.id,
            name: loc.name,
            address: loc.name,
            time: loc.time,
            purpose: loc.name,
            lat: loc.lat,
            lng: loc.lng,
            fullAddress: loc.name,
          };
        });
      }
    } else if (comparison.locations && Array.isArray(comparison.locations)) {
      comparison.locations.forEach((locChange: any) => {
        // GUARD: Skip invalid location changes
        if (!locChange || typeof locChange !== 'object') {
          console.warn('⚠️ Skipping invalid location change (not an object):', locChange);
          return;
        }
        
        if (!locChange.action) {
          console.warn('⚠️ Skipping location change without action:', locChange);
          return;
        }
        
        if (locChange.action === 'removed') {
          diff.locations.push({
            type: 'removed',
            index: locChange.currentIndex,
            oldAddress: locChange.currentLocation?.address || locChange.currentLocation?.name || '',
            oldTime: locChange.currentLocation?.time || '',
            oldPurpose: locChange.currentLocation?.purpose || locChange.currentLocation?.name || '',
          });
        } else if (locChange.action === 'added') {
          diff.locations.push({
            type: 'added',
            index: locChange.extractedIndex,
            newAddress: locChange.extractedLocation?.formattedAddress || locChange.extractedLocation?.location || '',
            newTime: locChange.extractedLocation?.time || '',
            newPurpose: locChange.extractedLocation?.purpose || '',
          });
          // Add to final locations
          if (locChange.finalLocation) {
            const finalLoc = locChange.finalLocation;
            
            // GUARD: Validate finalLocation is a proper object with required fields
            if (!finalLoc || typeof finalLoc !== 'object') {
              console.error('❌ Invalid finalLocation for added action (not an object):', finalLoc);
              return; // Skip this location
            }
            
            // GUARD: Ensure lat/lng exist and are numbers (allow 0 for now, existing logic handles it)
            if (finalLoc.lat === undefined || finalLoc.lng === undefined) {
              console.error('❌ Invalid finalLocation for added action (missing lat/lng):', finalLoc);
              return; // Skip this location
            }
            
            // Ensure finalLocation has valid coordinates
            if ((!finalLoc.lat || finalLoc.lat === 0) && locChange.extractedLocation?.lat && locChange.extractedLocation.lat !== 0) {
              finalLoc.lat = locChange.extractedLocation.lat;
            }
            if ((!finalLoc.lng || finalLoc.lng === 0) && locChange.extractedLocation?.lng && locChange.extractedLocation.lng !== 0) {
              finalLoc.lng = locChange.extractedLocation.lng;
            }
            // If still no coordinates, try to get from current location
            if ((!finalLoc.lat || finalLoc.lat === 0) && tripData?.locations[locChange.extractedIndex]?.lat) {
              finalLoc.lat = tripData.locations[locChange.extractedIndex].lat;
            }
            if ((!finalLoc.lng || finalLoc.lng === 0) && tripData?.locations[locChange.extractedIndex]?.lng) {
              finalLoc.lng = tripData.locations[locChange.extractedIndex].lng;
            }
            
            // CRITICAL FIX: Ensure fullAddress is set from extractedLocation for proper display
            if (!finalLoc.fullAddress && locChange.extractedLocation) {
              finalLoc.fullAddress = locChange.extractedLocation.formattedAddress || 
                                     locChange.extractedLocation.location || 
                                     finalLoc.address || 
                                     finalLoc.name;
            }
            
            finalLocationsMap[locChange.extractedIndex] = finalLoc;
          }
        } else if (locChange.action === 'modified') {
          diff.locations.push({
            type: 'modified',
            index: locChange.currentIndex,
            addressChanged: locChange.changes?.addressChanged || false,
            timeChanged: locChange.changes?.timeChanged || false,
            purposeChanged: locChange.changes?.purposeChanged || false,
            oldAddress: locChange.currentLocation?.address || locChange.currentLocation?.name || '',
            oldTime: locChange.currentLocation?.time || '',
            oldPurpose: locChange.currentLocation?.purpose || locChange.currentLocation?.name || '',
            newAddress: locChange.extractedLocation?.formattedAddress || locChange.extractedLocation?.location || '',
            newTime: locChange.extractedLocation?.time || '',
            newPurpose: locChange.extractedLocation?.purpose || '',
          });
          // Add to final locations (modified version) - use currentIndex to preserve position
          if (locChange.finalLocation) {
            const finalLoc = locChange.finalLocation;
            
            // GUARD: Validate finalLocation is a proper object with required fields
            if (!finalLoc || typeof finalLoc !== 'object') {
              console.error('❌ Invalid finalLocation for modified action (not an object):', finalLoc);
              // Fallback: Use current location if available
              const currentLoc = tripData?.locations[locChange.currentIndex];
              if (currentLoc) {
                console.log('↩️ Falling back to current location for index', locChange.currentIndex);
                finalLocationsMap[locChange.currentIndex] = currentLoc;
              }
              return; // Skip to next location
            }
            
            // GUARD: Ensure lat/lng exist (allow 0 for now, existing logic handles it)
            if (finalLoc.lat === undefined || finalLoc.lng === undefined) {
              console.error('❌ Invalid finalLocation for modified action (missing lat/lng):', finalLoc);
              // Fallback: Use current location if available
              const currentLoc = tripData?.locations[locChange.currentIndex];
              if (currentLoc) {
                console.log('↩️ Falling back to current location for index', locChange.currentIndex);
                finalLocationsMap[locChange.currentIndex] = currentLoc;
              }
              return; // Skip to next location
            }
            
            // Ensure finalLocation has valid coordinates
            if ((!finalLoc.lat || finalLoc.lat === 0) && locChange.extractedLocation?.lat && locChange.extractedLocation.lat !== 0) {
              finalLoc.lat = locChange.extractedLocation.lat;
            }
            if ((!finalLoc.lng || finalLoc.lng === 0) && locChange.extractedLocation?.lng && locChange.extractedLocation.lng !== 0) {
              finalLoc.lng = locChange.extractedLocation.lng;
            }
            // If still no coordinates, try to get from current location
            const currentLoc = tripData?.locations[locChange.currentIndex];
            if ((!finalLoc.lat || finalLoc.lat === 0) && currentLoc?.lat && currentLoc.lat !== 0) {
              finalLoc.lat = currentLoc.lat;
            }
            if ((!finalLoc.lng || finalLoc.lng === 0) && currentLoc?.lng && currentLoc.lng !== 0) {
              finalLoc.lng = currentLoc.lng;
            }
            
            // CRITICAL FIX: Ensure fullAddress is set from extractedLocation for proper display
            if (!finalLoc.fullAddress && locChange.extractedLocation) {
              finalLoc.fullAddress = locChange.extractedLocation.formattedAddress || 
                                     locChange.extractedLocation.location || 
                                     finalLoc.address || 
                                     finalLoc.name;
            }
            
            finalLocationsMap[locChange.currentIndex] = finalLoc;
          } else if (locChange.currentLocation && locChange.extractedLocation) {
            // Build final location from current + extracted
            const currentLoc = tripData?.locations[locChange.currentIndex];
            // Prioritize extracted coordinates, fallback to current, ensure we never use 0
            let lat = locChange.extractedLocation.lat && locChange.extractedLocation.lat !== 0 
              ? locChange.extractedLocation.lat 
              : (currentLoc?.lat && currentLoc.lat !== 0 ? currentLoc.lat : 0);
            let lng = locChange.extractedLocation.lng && locChange.extractedLocation.lng !== 0 
              ? locChange.extractedLocation.lng 
              : (currentLoc?.lng && currentLoc.lng !== 0 ? currentLoc.lng : 0);
            
            // CRITICAL FIX: Ensure fullAddress is properly set for display
            const fullAddress = locChange.extractedLocation.formattedAddress || 
                                locChange.extractedLocation.location || 
                                locChange.currentLocation.address ||
                                (currentLoc as any)?.fullAddress ||
                                locChange.currentLocation.name;
            
            finalLocationsMap[locChange.currentIndex] = {
              id: currentLoc?.id || (locChange.currentIndex + 1).toString(),
              name: locChange.extractedLocation.purpose || locChange.extractedLocation.formattedAddress || locChange.extractedLocation.location,
              address: locChange.extractedLocation.formattedAddress || locChange.extractedLocation.location,
              time: locChange.extractedLocation.time || locChange.currentLocation.time,
              purpose: locChange.extractedLocation.purpose || locChange.currentLocation.purpose || locChange.currentLocation.name,
              lat: lat,
              lng: lng,
              fullAddress: fullAddress,
            };
          }
        } else if (locChange.action === 'unchanged') {
          // Add unchanged location to final locations - ALWAYS preserve from current trip data
            const currentLoc = tripData?.locations[locChange.currentIndex];
            if (currentLoc) {
            // Always use current location data for unchanged locations to preserve coordinates
              finalLocationsMap[locChange.currentIndex] = {
                id: currentLoc.id,
                name: currentLoc.name,
                address: currentLoc.name,
                time: currentLoc.time,
                purpose: currentLoc.name,
                lat: currentLoc.lat,
                lng: currentLoc.lng,
              fullAddress: (currentLoc as any).fullAddress || currentLoc.name,
            };
          } else if (locChange.finalLocation) {
            // Fallback to finalLocation only if currentLoc doesn't exist
            finalLocationsMap[locChange.currentIndex] = locChange.finalLocation;
          }
        }
      });
    }

    // CRITICAL FIX: Ensure ALL current locations are preserved if not explicitly removed
    // This handles cases where the AI comparison might miss some unchanged locations
    if (tripData?.locations && tripData.locations.length > 0) {
      tripData.locations.forEach((currentLoc: any, idx: number) => {
        // If this location index doesn't exist in finalLocationsMap yet, add it
        if (finalLocationsMap[idx] === undefined) {
          console.log(`🔄 Preserving missing location at index ${idx}: ${currentLoc.name}`);
          finalLocationsMap[idx] = {
            id: currentLoc.id,
            name: currentLoc.name,
            address: currentLoc.name,
            time: currentLoc.time,
            purpose: currentLoc.name,
            lat: currentLoc.lat,
            lng: currentLoc.lng,
            fullAddress: (currentLoc as any).fullAddress || currentLoc.name,
          };
        }
        // Also ensure existing entries have valid coordinates
        else if (finalLocationsMap[idx] && (!finalLocationsMap[idx].lat || !finalLocationsMap[idx].lng || finalLocationsMap[idx].lat === 0 || finalLocationsMap[idx].lng === 0)) {
          console.log(`🔄 Restoring coordinates for location at index ${idx}: ${currentLoc.name}`);
          finalLocationsMap[idx].lat = currentLoc.lat;
          finalLocationsMap[idx].lng = currentLoc.lng;
        }
      });
    }

    // Sort final locations by index and add to diff
    const sortedIndices = Object.keys(finalLocationsMap)
      .map(k => parseInt(k))
      .filter(idx => !isNaN(idx))
      .sort((a, b) => a - b);
    
    diff.finalLocations = sortedIndices.map(idx => finalLocationsMap[idx]);

    // If no locations in final (shouldn't happen, but fallback), preserve all current locations
    if (diff.finalLocations.length === 0 && tripData?.locations && tripData.locations.length > 0) {
      console.log('⚠️ No final locations found, preserving all current locations as fallback');
      diff.finalLocations = tripData.locations.map((loc: any, idx: number) => ({
        id: loc.id,
        name: loc.name,
        address: loc.name,
        time: loc.time,
        purpose: loc.name,
        lat: loc.lat,
        lng: loc.lng,
        fullAddress: loc.name,
      }));
    }

    // Store additional comparison data for merging
    diff.comparisonData = comparison;

    return diff;
  };

  // Perform trip analysis update (regeneration)
  const performTripAnalysisUpdate = async (
    validLocations: Array<{ id: string; name: string; lat: number; lng: number; time: string; fullAddress?: string; purpose?: string }>,
    tripDateObj: Date,
    leadPassengerName?: string,
    vehicleInfo?: string,
    passengerCount?: number,
    tripDestination?: string,
    passengerNames?: string[],
    driverNotes?: string,
    latestChanges?: any
  ) => {
    if (!isGoogleMapsLoaded) {
      setError('Google Maps API is not loaded. Please refresh the page and try again.');
      setIsRegenerating(false);
      return;
    }

    setIsRegenerating(true);
    setError(null);

    try {
      const tripDateStr = tripDateObj.toISOString().split('T')[0];
      
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🔄 Regenerating Trip Analysis - Version ${(currentVersion || 1) + 1}`);
      console.log(`🗓️  Trip Date: ${tripDateStr}`);
      console.log(`📍 Analyzing ${validLocations.length} location(s)`);
      console.log(`${'='.repeat(80)}\n`);

      const days = 7; // Fixed period for trip planning

      // Fetch data for all locations in parallel
      const results = await Promise.all(
        validLocations.map(async (location) => {
          console.log(`\n🔍 Fetching data for Location ${numberToLetter(validLocations.indexOf(location) + 1)}: ${location.name} at ${location.time}`);
          
          const tempDistrictId = `custom-${Date.now()}-${location.id}`;

          const [crimeResponse, disruptionsResponse, weatherResponse, parkingResponse] = await Promise.all([
            fetch(`/api/uk-crime?district=${tempDistrictId}&lat=${location.lat}&lng=${location.lng}`),
            fetch(`/api/tfl-disruptions?district=${tempDistrictId}&days=${days}`),
            fetch(`/api/weather?district=${tempDistrictId}&lat=${location.lat}&lng=${location.lng}&days=${days}`),
            fetch(`/api/parking?lat=${location.lat}&lng=${location.lng}&location=${encodeURIComponent(location.name)}`)
          ]);

          // Check if any response failed
          const responses = [crimeResponse, disruptionsResponse, weatherResponse, parkingResponse];
          const responseNames = ['crime', 'disruptions', 'weather', 'parking'];
          
          for (let i = 0; i < responses.length; i++) {
            if (!responses[i].ok) {
              const errorText = await responses[i].text();
              console.error(`❌ ${responseNames[i]} API failed:`, responses[i].status, errorText);
              throw new Error(`${responseNames[i]} API returned ${responses[i].status}: ${errorText}`);
            }
          }

          const [crimeData, disruptionsData, weatherData, parkingData] = await Promise.all([
            crimeResponse.json(),
            disruptionsResponse.json(),
            weatherResponse.json(),
            parkingResponse.json()
          ]);

          // Create placeholder events data
          const eventsData = {
            success: true,
            data: {
              location: location.name,
              coordinates: { lat: location.lat, lng: location.lng },
              date: tripDateStr,
              events: [],
              summary: { total: 0, byType: {}, bySeverity: {}, highSeverity: 0 }
            }
          };

          // Fetch cafes
          let cafeData = null;
          try {
            cafeData = await searchNearbyCafes(location.lat, location.lng, location.name);
          } catch (cafeError) {
            console.error('❌ Error fetching cafes:', cafeError);
            cafeData = {
              location: location.name,
              coordinates: { lat: location.lat, lng: location.lng },
              cafes: [],
              summary: { total: 0, averageRating: 0, averageDistance: 0 },
            };
          }

          // Fetch emergency services
          let emergencyServicesData = null;
          try {
            emergencyServicesData = await searchEmergencyServices(location.lat, location.lng, location.name);
          } catch (emergencyError) {
            console.error('❌ Error fetching emergency services:', emergencyError);
            emergencyServicesData = {
              location: location.name,
              coordinates: { lat: location.lat, lng: location.lng },
            };
          }

          if (crimeData.success && disruptionsData.success && weatherData.success && parkingData.success) {
            return {
              locationId: location.id,
              locationName: location.name,
              fullAddress: location.fullAddress || location.name,
              time: location.time,
              data: {
                crime: crimeData.data,
                disruptions: disruptionsData.data,
                weather: weatherData.data,
                events: eventsData.data,
                parking: parkingData.data,
                cafes: cafeData,
                emergencyServices: emergencyServicesData,
              },
            };
          } else {
            throw new Error(`Failed to fetch data for ${location.name}`);
          }
        })
      );

      // Get traffic predictions
      console.log('🚦 Fetching traffic predictions...');
      let trafficData = null;
      try {
        trafficData = await getTrafficPredictions(validLocations, tripDateStr);
      } catch (trafficError) {
        console.error('❌ Traffic prediction error:', trafficError);
        trafficData = {
          success: false,
          error: 'Failed to get traffic predictions',
        };
      }

      // Generate executive report
      console.log('🤖 Generating Executive Peace of Mind Report...');
      let executiveReportData = null;
      
      try {
        const reportData = results.map(r => ({
          locationName: r.locationName,
          time: r.time,
          crime: r.data.crime,
          disruptions: r.data.disruptions,
          weather: r.data.weather,
          events: r.data.events,
          parking: r.data.parking,
          cafes: r.data.cafes,
        }));

        const reportResponse = await fetch('/api/executive-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripData: reportData,
            tripDate: tripDateStr,
            routeDistance: trafficData?.totalDistance || '0 km',
            routeDuration: trafficData?.totalMinutes || 0,
            trafficPredictions: trafficData?.success ? trafficData.data : null,
            emailContent: updateText || null,
            leadPassengerName: leadPassengerName || null,
            vehicleInfo: vehicleInfo || null,
            passengerCount: passengerCount || 1,
            tripDestination: tripDestination || null,
            passengerNames: passengerNames || [],
            driverNotes: driverNotes || null,
          }),
        });

        const reportResult = await reportResponse.json();
        
        if (reportResult.success) {
          executiveReportData = reportResult.data;
          console.log('✅ Executive Report Generated!');
        }
      } catch (reportError) {
        console.error('⚠️ Could not generate executive report:', reportError);
      }

      // Prepare passenger name for database storage
      let passengerNameForDb: string | null = null;
      if (passengerNames && passengerNames.length > 0) {
        passengerNameForDb = passengerNames.join(', ');
      } else if (leadPassengerName) {
        passengerNameForDb = leadPassengerName;
      }

      // Prepare update data with incremented version
      // Ensure traffic_predictions has the correct structure with success flag
      const trafficPredictionsForDb = trafficData?.success ? {
        success: true,
        data: trafficData.data,
        totalDistance: trafficData.totalDistance,
        totalMinutes: trafficData.totalMinutes,
        totalMinutesNoTraffic: trafficData.totalMinutesNoTraffic,
      } : {
        success: false,
        data: null,
        error: trafficData?.error || 'Failed to get traffic predictions',
      };

      // Update locations with coordinates and addresses from analysis results
      // The results array has correct coordinates from crime API and is in the same order as validLocations
      // Match by index since results are created in the same order as validLocations were processed
      const locationsWithCoordinates = validLocations.map((loc, idx) => {
        const result = results[idx]; // Match by index - results are in same order as validLocations
        if (result && result.data && result.data.crime && result.data.crime.coordinates) {
          // Use coordinates from analysis results (most accurate - comes from crime API)
          // Also update fullAddress if available from results
          return {
            ...loc,
            lat: result.data.crime.coordinates.lat,
            lng: result.data.crime.coordinates.lng,
            fullAddress: result.fullAddress || loc.fullAddress || loc.name,
            name: result.locationName || loc.name, // Use location name from results if available
          };
        }
        // If no result found at this index, log warning and keep original location
        console.warn(`⚠️ No result found at index ${idx} for location ${loc.id} (${loc.name}), keeping original location`);
        console.warn(`   Results length: ${results.length}, validLocations length: ${validLocations.length}`);
        return loc;
      });

      console.log('💾 [DEBUG] Locations with coordinates before saving:');
      locationsWithCoordinates.forEach((loc, idx) => {
        console.log(`   ${idx + 1}. ${loc.name} - (${loc.lat}, ${loc.lng}) - ${loc.fullAddress}`);
      });

      const updateData: any = {
        trip_date: tripDateStr,
        locations: locationsWithCoordinates as any,
        trip_results: results as any,
        traffic_predictions: trafficPredictionsForDb as any,
        executive_report: executiveReportData as any,
        trip_notes: driverNotes || null,
        lead_passenger_name: passengerNameForDb,
        vehicle: vehicleInfo || null,
        passenger_count: passengerCount || 1,
        trip_destination: tripDestination || null,
        version: (currentVersion || 1) + 1,
        updated_at: new Date().toISOString(),
        latest_changes: latestChanges || null,
      };

      // Update trip in database
      console.log(`💾 Updating trip ${tripId} with version ${updateData.version}...`);
      const { data: updatedTrip, error: updateError } = await supabase
        .from('trips')
        .update(updateData)
        .eq('id', tripId)
        .select()
        .single();

      if (updateError || !updatedTrip) {
        console.error('❌ Error updating trip:', updateError);
        throw new Error(`Failed to update trip: ${updateError?.message || 'Unknown error'}`);
      }

      console.log('✅ Trip updated successfully');
      console.log(`🔗 Trip ID: ${tripId}`);
      console.log(`📌 Version: ${updateData.version}`);

      // Refresh the page to show updated data
      window.location.reload();
    } catch (err) {
      console.error('❌ Error regenerating report:', err);
      setError(err instanceof Error ? err.message : 'Failed to regenerate report');
      setIsRegenerating(false);
    }
  };

  // Regenerate report handler
  const handleRegenerateReport = async () => {
    // Security check: Only owners can regenerate reports
    if (!isOwner) {
      console.error('❌ Unauthorized: Only trip owners can regenerate reports');
      setError('Only trip owners can regenerate reports');
      return;
    }

    if (!comparisonDiff || !extractedUpdates || !tripData) return;

    setIsRegenerating(true);
    setError(null);

    try {
      // Use finalLocations from AI comparison (already merged intelligently)
      const finalLocations = comparisonDiff.finalLocations || [];
      
      // Convert final locations to format expected by performTripAnalysis
      // Log for debugging
      console.log('🔍 [DEBUG] Final locations before validation:', JSON.stringify(finalLocations, null, 2));
      
      // Filter out locations with invalid coordinates (lat === 0 && lng === 0)
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
            console.warn(`⚠️ [DEBUG] Location ${idx + 1} (${location.name}) has invalid coordinates (0, 0)`);
          }
          
          return location;
        })
        .filter((loc: any) => {
          const isValid = loc.lat !== 0 || loc.lng !== 0;
          if (!isValid) {
            console.warn(`⚠️ [DEBUG] Filtering out location "${loc.name}" due to invalid coordinates`);
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

      // Geocode any locations that don't have valid coordinates before analysis
      // This ensures we have accurate coordinates from Google Maps (like in original flow)
      console.log('🗺️ [DEBUG] Geocoding locations without valid coordinates...');
      const geocodedLocations = await Promise.all(
        validLocations.map(async (loc: any) => {
          // If coordinates are invalid (0, 0), geocode the location
          if (loc.lat === 0 && loc.lng === 0) {
            try {
              console.log(`   Geocoding: ${loc.name || loc.fullAddress || loc.address || 'Unknown location'}`);
              
              // Use Google Maps Geocoding API
              const geocoder = new google.maps.Geocoder();
              const query = loc.fullAddress || loc.address || loc.name || '';
              
              return new Promise<typeof loc>((resolve) => {
                geocoder.geocode(
                  { address: `${query}, London, UK`, region: 'uk' },
                  (results, status) => {
                    if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
                      const result = results[0];
                      const geocodedLoc = {
                        ...loc,
                        lat: result.geometry.location.lat(),
                        lng: result.geometry.location.lng(),
                        fullAddress: result.formatted_address || loc.fullAddress || loc.address || loc.name,
                      };
                      console.log(`   ✅ Geocoded: ${geocodedLoc.name} → (${geocodedLoc.lat}, ${geocodedLoc.lng})`);
                      resolve(geocodedLoc);
                    } else {
                      console.warn(`   ⚠️ Geocoding failed for: ${query} (status: ${status})`);
                      // Keep original location even if geocoding fails
                      resolve(loc);
                    }
                  }
                );
              });
            } catch (geocodeError) {
              console.error(`   ❌ Error geocoding ${loc.name}:`, geocodeError);
              // Keep original location if geocoding fails
              return loc;
            }
          }
          // Location already has valid coordinates
          return loc;
        })
      );

      console.log('✅ [DEBUG] Geocoding complete');
      geocodedLocations.forEach((loc, idx) => {
        console.log(`   ${idx + 1}. ${loc.name} - (${loc.lat}, ${loc.lng})`);
      });

      // Replace validLocations with geocoded locations
      const finalValidLocations = geocodedLocations;

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

  // Show loading state until ownership is checked
  if (loading || !ownershipChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Loading Your Trip Analysis...
          </h2>
          <div className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-6 w-6 text-primary" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-muted-foreground">Please wait...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !tripData || !tripData.tripResults) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="p-8 text-center">
          <h2 className="text-2xl font-bold text-card-foreground mb-4">
            Trip Not Found
          </h2>
          <p className="text-muted-foreground mb-6">
            {error || 'This trip analysis could not be found. It may have been deleted or the link is incorrect.'}
          </p>
          <Button
            onClick={() => router.push('/')}
            size="lg"
          >
            Go to Home
          </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Password verification form for protected reports (show only if explicitly flagged)
  if (showPasswordGate) {
    const handlePasswordSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setPasswordError(null);
      setVerifyingPassword(true);

      try {
        const response = await fetch('/api/verify-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId: tripId,
            password: passwordInput,
          }),
        });

        const result = await response.json();

        if (result.success) {
          setIsPasswordVerified(true);
          setShowPasswordGate(false); // Hide password gate
          setPasswordError(null);
          console.log('✅ Password verified successfully');
        } else {
          setPasswordError(result.error || 'Incorrect password');
          setPasswordInput('');
        }
      } catch (err) {
        console.error('Error verifying password:', err);
        setPasswordError('Failed to verify password. Please try again.');
      } finally {
        setVerifyingPassword(false);
      }
    };

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary mb-4">
                <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-card-foreground mb-2">
                Password Protected Report
              </h2>
              <p className="text-muted-foreground">
                This report is password protected. Please enter the password to continue.
              </p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <Input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter password"
                  className="text-center"
                  autoFocus
                  disabled={verifyingPassword}
                />
                {passwordError && (
                  <Alert className="mt-3">
                    <AlertDescription className="text-destructive text-sm">
                      {passwordError}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
                disabled={!passwordInput || verifyingPassword}
              >
                {verifyingPassword ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Verifying...
                  </>
                ) : (
                  'Unlock Report'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Button
                onClick={() => router.push('/')}
                variant="outline"
                size="sm"
              >
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { tripDate, locations, tripResults, trafficPredictions, executiveReport } = tripData;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header with Navigation */}

        {/* Notify Driver Button - Only for Owners */}
        {isOwner && driverEmail && (
          <div className="mb-6">
            {notificationSuccess && (
              <Alert className="mb-4 bg-[#3ea34b]/10 border-[#3ea34b]/30">
                <AlertDescription className="text-[#3ea34b]">
                  ✅ Driver notified successfully! Email sent to {driverEmail}
                </AlertDescription>
              </Alert>
            )}
            
            {notificationError && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{notificationError}</AlertDescription>
              </Alert>
            )}
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
              <div>
                    <p className="text-base font-semibold text-card-foreground">
                  Driver: <span className="text-primary">{driverEmail}</span>
                </p>
                    <p className="text-sm text-muted-foreground mt-1">
                  Send email notification to the assigned driver
                </p>
              </div>
              <Button
                onClick={handleNotifyDriver}
                disabled={notifyingDriver}
                    size="lg"
                className="flex items-center gap-2 bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
              >
                {notifyingDriver ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                        <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Notify Driver
                  </>
                )}
              </Button>
            </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Update Trip Section - Only show for owners */}
        {isOwner && !isLiveMode && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">Update Trip Information</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="update-text" className="block text-sm font-medium mb-2">
                    Paste updated trip information (email, message, etc.)
                  </label>
                  <textarea
                    id="update-text"
                    value={updateText}
                    onChange={(e) => setUpdateText(e.target.value)}
                    placeholder="Paste any updated trip information here..."
                    className="w-full min-h-[120px] p-3 border rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={isExtracting || isRegenerating}
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleExtractUpdates}
                    disabled={!updateText.trim() || isExtracting || isRegenerating}
                    size="lg"
                    className="flex items-center gap-2 bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
                  >
                    {isExtracting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Extracting...</span>
                      </>
                    ) : (
                      'Extract Updates'
                    )}
                  </Button>
                  {extractedUpdates && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setUpdateText('');
                        setExtractedUpdates(null);
                        setShowPreview(false);
                        setComparisonDiff(null);
                        setUpdateProgress({ step: '', error: null, canRetry: false });
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>

                {/* Enhanced Error Display with Step Information */}
                {updateProgress.error && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-semibold">
                          ❌ Failed at: {updateProgress.step}
                        </p>
                        <p className="text-sm">
                          {updateProgress.error}
                        </p>
                        {updateProgress.canRetry && (
                          <Button
                            onClick={handleExtractUpdates}
                            variant="outline"
                            size="sm"
                            className="mt-2"
                          >
                            🔄 Retry
                          </Button>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Progress Indicator */}
                {isExtracting && updateProgress.step && !updateProgress.error && (
                  <Alert className="mt-4">
                    <AlertDescription>
                      <div className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span className="text-sm">{updateProgress.step}...</span>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview/Diff Section */}
        {showPreview && comparisonDiff && isOwner && !isLiveMode && (
          <Card className="mb-6 border border-primary/60">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">Preview Changes</h2>
              <div className="space-y-4">
                {/* Trip Date Changes */}
                {comparisonDiff.tripDateChanged && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <div className="font-medium mb-1">Trip Date Updated:</div>
                    <div className="text-sm">
                      <span className="line-through text-muted-foreground">
                        {new Date(tripDate).toLocaleDateString()}
                      </span>
                      {' → '}
                      <span className="font-semibold">
                        {new Date(extractedUpdates.date || tripDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Location Changes */}
                {comparisonDiff.locations.length > 0 && (
                  <div className="space-y-2">
                    <div className="font-medium mb-2">Location Changes:</div>
                    {comparisonDiff.locations.map((locChange: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg ${
                          locChange.type === 'added'
                            ? 'bg-[#3ea34b]/10'
                            : locChange.type === 'removed'
                            ? 'bg-red-50 dark:bg-red-900/20'
                            : 'bg-yellow-50 dark:bg-yellow-900/20'
                        }`}
                      >
                        <div className="font-medium mb-1">
                          Location {idx + 1} - {locChange.type === 'added' ? 'Added' : locChange.type === 'removed' ? 'Removed' : 'Modified'}
                        </div>
                        {locChange.type === 'modified' && (
                          <div className="text-sm space-y-1">
                            {locChange.addressChanged && (
                              <div>
                                <span className="text-muted-foreground">Address: </span>
                                <span className="line-through">{locChange.oldAddress}</span>
                                {' → '}
                                <span className="font-semibold">{locChange.newAddress}</span>
                              </div>
                            )}
                            {locChange.timeChanged && (
                              <div>
                                <span className="text-muted-foreground">Time: </span>
                                <span className="line-through">{locChange.oldTime}</span>
                                {' → '}
                                <span className="font-semibold">{locChange.newTime}</span>
                              </div>
                            )}
                            {locChange.purposeChanged && (
                              <div>
                                <span className="text-muted-foreground">Purpose: </span>
                                <span className="line-through">{locChange.oldPurpose}</span>
                                {' → '}
                                <span className="font-semibold">{locChange.newPurpose}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {locChange.type === 'added' && (
                          <div className="text-sm">
                            <div><span className="font-semibold">Address:</span> {locChange.newAddress}</div>
                            <div><span className="font-semibold">Time:</span> {locChange.newTime}</div>
                            <div><span className="font-semibold">Purpose:</span> {locChange.newPurpose}</div>
                          </div>
                        )}
                        {locChange.type === 'removed' && (
                          <div className="text-sm">
                            <div><span className="font-semibold">Address:</span> {locChange.oldAddress}</div>
                            <div><span className="font-semibold">Time:</span> {locChange.oldTime}</div>
                            <div><span className="font-semibold">Purpose:</span> {locChange.oldPurpose}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Passenger Info Changes */}
                {(comparisonDiff.passengerInfoChanged || comparisonDiff.vehicleInfoChanged) && (
                  <div className="space-y-2">
                    {comparisonDiff.passengerInfoChanged && (
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <div className="font-medium mb-1">Passenger Info Updated:</div>
                        <div className="text-sm">
                          <span className="line-through text-muted-foreground">{leadPassengerName || 'None'}</span>
                          {' → '}
                          <span className="font-semibold">{extractedUpdates.leadPassengerName || extractedUpdates.passengerNames?.join(', ') || 'None'}</span>
                        </div>
                      </div>
                    )}
                    {comparisonDiff.vehicleInfoChanged && (
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <div className="font-medium mb-1">Vehicle Updated:</div>
                        <div className="text-sm">
                          <span className="line-through text-muted-foreground">{vehicleInfo || 'None'}</span>
                          {' → '}
                          <span className="font-semibold">{extractedUpdates.vehicleInfo || 'None'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes Preview */}
                {comparisonDiff.notesChanged && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="font-medium mb-2">Merged Notes Preview:</div>
                    <div className="text-sm whitespace-pre-wrap">{comparisonDiff.mergedNotes}</div>
                  </div>
                )}

                {/* Regenerate Button */}
                <div className="pt-4 border-t">
                  <Button
                    onClick={handleRegenerateReport}
                    disabled={isRegenerating}
                    size="lg"
                    className="w-full flex items-center justify-center gap-2 bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
                  >
                    {isRegenerating ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Regenerating Report...</span>
                      </>
                    ) : (
                      'Regenerate Report'
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Section */}
        <div className="mb-8">


          {/* Service Introduction */}
          {!isLiveMode && (
              <div className="p-8 mb-6">
                {/* Header with Passenger Information, Status, and Live Trip Button */}
                <div className="flex items-start justify-between mb-4">
                  {/* Passenger Information with Status */}
                  <div className="flex-1 flex items-center justify-between gap-4">
                    <h1 className="text-4xl font-light text-card-foreground mb-1 tracking-tight">
                      {(() => {
                        // Extract passenger name from driver notes
                        const extractPassengerName = (text: string | null): string | null => {
                          if (!text) return null;
                          const patterns = [
                            /(?:Mr\.|Mrs\.|Ms\.|Dr\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
                            /(?:Client|Passenger|Guest):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
                            /(?:for|with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
                            /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
                          ];
                          
                          for (const pattern of patterns) {
                            const match = text.match(pattern);
                            if (match && match[1]) {
                              return match[1].trim();
                            }
                          }
                          return null;
                        };

                        // Get lead passenger name
                        const leadPassenger = passengerNames && passengerNames.length > 0 
                                            ? passengerNames[0] 
                                            : leadPassengerName || extractPassengerName(driverNotes) || 'Passenger';

                        // Extract number of passengers (default to 1 if not specified)
                        const extractPassengerCount = (text: string | null): number => {
                          if (!text) return 1;
                          const patterns = [
                            /(\d+)\s*(?:passengers?|people|guests?)/i,
                            /(?:x|×)\s*(\d+)/i,
                            /(\d+)\s*(?:pax|persons?)/i,
                          ];
                          
                          for (const pattern of patterns) {
                            const match = text.match(pattern);
                            if (match && match[1]) {
                              const count = parseInt(match[1]);
                              if (count > 0 && count <= 20) return count;
                            }
                          }
                          return 1;
                        };

                        const numberOfPassengers = passengerCount || 
                                            extractPassengerCount(driverNotes) || 
                                            1;

                        // Get trip destination
                        const getDestination = (): string => {
                          // First try tripDestination
                          if (tripDestination) return tripDestination;
                          
                          // Then try to get city from first location
                          if (locations && locations.length > 0) {
                            const firstLocation = locations[0];
                            if (firstLocation.name) {
                              const parts = firstLocation.name.split(',');
                              if (parts.length >= 2) {
                                return parts[parts.length - 1].trim();
                              }
                            }
                          }
                          return 'Location';
                        };

                        const destination = getDestination();
                        
                        // Calculate trip duration or determine if it's a transfer
                        const getTripDurationOrTransfer = (): string => {
                          if (locations && locations.length === 2) {
                            // Calculate duration
                            const pickupTime = parseInt(locations[0]?.time) || 0;
                            const dropoffTime = parseInt(locations[1]?.time) || 0;
                            const durationHours = dropoffTime - pickupTime;
                            
                            // If duration is under 3 hours, it's a transfer
                            if (durationHours < 3) {
                              // Check if either location is an airport
                              const hasAirport = locations.some((loc: any) => {
                                const locName = loc.name?.toLowerCase() || loc.formattedAddress?.toLowerCase() || '';
                                return locName.includes('airport') || 
                                       locName.includes('heathrow') || 
                                       locName.includes('gatwick') || 
                                       locName.includes('stansted') || 
                                       locName.includes('luton') ||
                                       locName.includes('city airport');
                              });
                              
                              return hasAirport ? 'Airport Transfer' : 'Transfer';
                        } else {
                              // Show duration if 3 hours or more
                              const hours = Math.floor(durationHours);
                              const minutes = Math.round((durationHours - hours) * 60);
                              return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
                            }
                          } else if (locations && locations.length >= 2) {
                            // Calculate duration for trips with more than 2 locations
                            const pickupTime = parseInt(locations[0]?.time) || 0;
                            const dropoffTime = parseInt(locations[locations.length - 1]?.time) || 0;
                            const durationHours = dropoffTime - pickupTime;
                            
                            if (durationHours > 0) {
                              const hours = Math.floor(durationHours);
                              const minutes = Math.round((durationHours - hours) * 60);
                              return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
                            }
                          }
                          return 'Transfer';
                        };

                        const durationOrTransfer = getTripDurationOrTransfer();
                        
                        // Format: "Name Duration/Transfer in Destination (x Number)"
                        return `${leadPassenger} ${durationOrTransfer} in ${destination} (x${numberOfPassengers})`;
                      })()}
                    </h1>
                    
                    {/* Trip Status - Aligned to right of trip name */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${tripStatus === 'confirmed' ? 'bg-[#3ea34b]' : 'bg-gray-400'}`}></div>
                        <span className={`text-lg font-semibold ${tripStatus === 'confirmed' ? 'text-[#3ea34b]' : 'text-gray-600'}`}>
                          {tripStatus === 'confirmed' ? 'Confirmed' : 'Not Confirmed'}
                        </span>
                      </div>
                      {isOwner && (
                      <button 
                          onClick={handleStatusToggle}
                          disabled={updatingStatus}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                            tripStatus === 'confirmed' ? 'bg-[#3ea34b]' : 'bg-gray-400'
                          } ${updatingStatus ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          aria-label="Toggle trip status"
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              tripStatus === 'confirmed' ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                      </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Trip Details Grid */}
                <div className="grid grid-cols-1 gap-1">
                  {/* Trip Date */}
                  <div className="py-2">
                    <div className="flex items-center gap-4">
                      <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <div>
                        <span className="text-base text-muted-foreground">Trip date: </span>
                        <span className="text-lg font-semibold text-card-foreground">{new Date(tripDate).toLocaleDateString('en-GB', { 
                          weekday: 'long', 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric' 
                        })}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Passenger Name(s) */}
                  {leadPassengerName && (
                    <div className="py-2">
                      <div className="flex items-center gap-4">
                        <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <div>
                          <span className="text-base text-muted-foreground">Passenger{leadPassengerName.includes(',') ? 's' : ''}: </span>
                          <span className="text-lg font-semibold text-card-foreground">{leadPassengerName}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Vehicle Information */}
                  {(() => {
                    const carInfo = vehicleInfo || extractCarInfo(driverNotes);
                    if (carInfo) {
                      return (
                        <div className="py-2">
                          <div className="flex items-center gap-4">
                            <Car className="w-6 h-6 text-muted-foreground" />
                            <div>
                              <span className="text-base text-muted-foreground">Vehicle: </span>
                              <span className="text-lg font-semibold text-card-foreground">{carInfo}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

              </div>
          )}

          {/* Trip Summary Cards */}
          {!isLiveMode && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {/* Pickup Time */}
              <Card className="border border-border/40">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                    <span className="text-sm font-medium text-foreground">Pickup Time</span>
                </div>
                  <p className="text-3xl font-bold text-foreground">
                    {locations[0]?.time ? getLondonLocalTime(locations[0].time) : 'N/A'}
                  </p>
                </CardContent>
              </Card>

              {/* Estimated Duration */}
              <Card className="border border-border/40">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                    <span className="text-sm font-medium text-foreground">Trip Duration</span>
                </div>
                  <p className="text-3xl font-bold text-foreground">
                    {(() => {
                      if (locations && locations.length >= 2) {
                        const pickupTime = parseInt(locations[0]?.time) || 0;
                        const dropoffTime = parseInt(locations[locations.length - 1]?.time) || 0;
                        const duration = dropoffTime - pickupTime;
                        
                        if (duration > 0) {
                          const hours = Math.floor(duration);
                          const minutes = Math.round((duration - hours) * 60);
                          return `${hours}h ${minutes}m`;
                        } else {
                          return 'Same day';
                        }
                      }
                      return 'N/A';
                    })()}
                  </p>
                </CardContent>
              </Card>

              {/* Estimated Mileage */}
              <Card className="border border-border/40">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                    <span className="text-sm font-medium text-foreground">Estimated Distance</span>
                </div>
                  <p className="text-3xl font-bold text-foreground">
                    {(() => {
                      // Check if traffic predictions exist and have the correct structure
                      if (trafficPredictions?.success && trafficPredictions.data && Array.isArray(trafficPredictions.data) && trafficPredictions.data.length > 0) {
                        // Calculate total distance from traffic predictions
                        const totalKm = trafficPredictions.data.reduce((total: number, route: any) => {
                          if (route.distance) {
                            // Parse distance (format: "5.2 km" or just number)
                            const distanceStr = typeof route.distance === 'string' ? route.distance : String(route.distance);
                            const distanceKm = parseFloat(distanceStr.replace(/[^\d.]/g, ''));
                            return total + (isNaN(distanceKm) ? 0 : distanceKm);
                          }
                          return total;
                        }, 0);
                        
                        // Convert km to miles (1 km = 0.621371 miles)
                        const totalMiles = totalKm * 0.621371;
                        return totalMiles > 0 ? totalMiles.toFixed(1) + ' miles' : 'Calculating...';
                      }
                      
                      // Fallback: try to use totalDistance from trafficPredictions if available
                      if (trafficPredictions?.totalDistance) {
                        const distanceStr = trafficPredictions.totalDistance;
                        const distanceKm = parseFloat(distanceStr.replace(/[^\d.]/g, ''));
                        if (!isNaN(distanceKm) && distanceKm > 0) {
                          const totalMiles = distanceKm * 0.621371;
                          return totalMiles.toFixed(1) + ' miles';
                        }
                      }
                      
                      return 'Calculating...';
                    })()}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Trip Locations */}
          {!isLiveMode && (
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-card-foreground">Trip Locations</h3>
                  
                  {/* Live Trip Button - Always visible */}
                  {(() => {
                    const now = new Date();
                    const tripDateTime = new Date(tripDate);
                    const oneHourBefore = new Date(tripDateTime.getTime() - 60 * 60 * 1000);
                    const isLiveTripActive = now >= oneHourBefore;
                    
                    return (
                      <button 
                        className={`px-4 py-2 font-medium rounded-lg transition-all duration-300 flex items-center gap-2 text-sm ${
                          isLiveTripActive 
                            ? 'bg-[#3ea34b] text-white shadow-md hover:shadow-lg hover:bg-[#359840]' 
                            : 'bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] hover:opacity-90'
                        }`}
                        onClick={() => {
                          if (isLiveMode) {
                            stopLiveTrip();
                          } else {
                            startLiveTrip();
                          }
                        }}
                        title={isLiveMode ? 'Stop live trip tracking' : 'Start live trip tracking'}
                      >
                        {isLiveTripActive ? (
                          <>
                            <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                            <span className="font-medium">
                              {isLiveMode ? 'Stop Live Trip' : 'Live Trip'}
                            </span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                            </svg>
                            <span className="font-medium">
                              View Route Breakdown
                            </span>
                          </>
                        )}
                      </button>
                    );
                  })()}
                </div>
            <div className="relative">
              {/* Connecting Line */}
              <div 
                className="absolute w-px bg-primary/30"
                style={{ 
                  height: `${(locations.length - 1) * 4.5}rem - 1.5rem`,
                  left: '0.75rem',
                  top: '0.75rem'
                }}
              ></div>
              
              {/* Transparent Line After Drop-off */}
              <div 
                className="absolute w-px bg-transparent"
                style={{ 
                  height: '1.5rem',
                  left: '0.75rem',
                  top: `${(locations.length - 1) * 4.5}rem`
                }}
              ></div>
              
              <div className="space-y-3">
                {locations.map((location: any, index: number) => (
                  <div key={location.id || index} id={`location-${index}`} className="flex items-start gap-3 relative z-10">
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold border-2 border-background ${
                      (isLiveMode && activeLocationIndex === index) || (!isLiveMode && isTripWithinOneHour() && findClosestLocation() === index)
                        ? 'animate-live-pulse text-white' 
                        : 'bg-primary text-primary-foreground'
                    }`}>
                      {String.fromCharCode(65 + index)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start">
                        <div className="w-32 flex-shrink-0">
                          <div className="text-sm font-medium text-muted-foreground mb-1">
                            {index === 0 ? 'Pickup' : 
                             index === locations.length - 1 ? 'Drop-off' : 
                             'Resume at'}
                            {((isLiveMode && activeLocationIndex === index) || (!isLiveMode && isTripWithinOneHour() && findClosestLocation() === index)) && (
                              <span className="ml-2 px-2 py-1 text-xs font-bold text-white bg-[#3ea34b] rounded">
                                LIVE
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {getLondonLocalTime(location.time)}
                          </div>
                        </div>
                        <div className="flex-1 ml-12">
                          <button 
                            onClick={() => {
                              const address = location.formattedAddress || location.fullAddress || location.address || location.name;
                              const encodedAddress = encodeURIComponent(address);
                              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
                              
                              // Calculate center position for popup
                              const width = 800;
                              const height = 600;
                              const left = (screen.width - width) / 2;
                              const top = (screen.height - height) / 2;
                              
                              window.open(mapsUrl, '_blank', `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`);
                            }}
                            className="text-left hover:text-primary transition-colors cursor-pointer block w-full"
                            title={location.formattedAddress || location.fullAddress || location.address || location.name}
                          >
                            {(() => {
                              const fullAddr = location.formattedAddress || location.fullAddress || location.address || location.name;
                              const { businessName, restOfAddress } = formatLocationDisplay(fullAddr);
                              const flightMap = extractFlightNumbers(driverNotes);
                              
                              // Check if this location is an airport and has flight numbers
                              const isAirport = businessName.toLowerCase().includes('airport') || 
                                              businessName.toLowerCase().includes('heathrow') ||
                                              businessName.toLowerCase().includes('gatwick') ||
                                              businessName.toLowerCase().includes('stansted') ||
                                              businessName.toLowerCase().includes('luton');
                              
                              let displayBusinessName = businessName;
                              
                              if (isAirport && Object.keys(flightMap).length > 0) {
                                // Find matching airport in flight map
                                const matchingAirport = Object.keys(flightMap).find(airport => 
                                  businessName.toLowerCase().includes(airport.toLowerCase().replace(' airport', ''))
                                );
                                
                                if (matchingAirport && flightMap[matchingAirport].length > 0) {
                                  const flights = flightMap[matchingAirport].join(', ');
                                  displayBusinessName = `${businessName} for flight ${flights}`;
                                }
                              }
                              
                              return (
                                <div>
                                  <div className="text-lg font-semibold text-card-foreground">
                                    {displayBusinessName}
                                  </div>
                                  {restOfAddress && (
                                    <div className="text-sm text-muted-foreground mt-0.5">
                                      {restOfAddress}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
              </CardContent>
            </Card>
          )}

          {/* Driver Warnings Box */}
          {!isLiveMode && (
            <Card className="mb-6">
              <CardContent className="p-6">
            <h3 className="text-xl font-semibold text-card-foreground mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Driver Warnings
            </h3>
            
            <div className="space-y-4">
              {/* Very Important Information */}
              {executiveReport?.exceptionalInformation && (
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#9e201b' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                        <div className="text-lg text-card-foreground leading-relaxed">
                        {executiveReport.exceptionalInformation?.split('\n').map((point: string, index: number) => (
                          <div key={index} className="flex items-start gap-2 mb-1">
                              <span className="text-muted-foreground mt-1">•</span>
                            <span>{point.trim().replace(/^[-•*]\s*/, '')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  </CardContent>
                </Card>
              )}

              {/* Important Information */}
              {executiveReport?.importantInformation && (
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                        <h4 className="font-semibold text-card-foreground mb-1">Important Information</h4>
                        <div className="text-sm text-card-foreground leading-relaxed">
                        {executiveReport.importantInformation?.split('\n').map((point: string, index: number) => (
                          <div key={index} className="flex items-start gap-2 mb-1">
                              <span className="text-muted-foreground mt-1">•</span>
                            <span>{point.trim().replace(/^[-•*]\s*/, '')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  </CardContent>
                </Card>
              )}

              {/* Smart Warning Detection */}
              {(() => {
                const warnings = [];
                const notes = driverNotes?.toLowerCase() || '';
                const destination = tripDestination?.toLowerCase() || '';
                
                // Check driver notes for warning patterns
                if (notes.includes('onboard') || notes.includes('in car') || notes.includes('during trip')) {
                  warnings.push('🚙 ONBOARD SERVICES: Special services required during the journey');
                }
                if (notes.includes('time') && (notes.includes('strict') || notes.includes('exact') || notes.includes('precise'))) {
                  warnings.push('⏱️ TIME CRITICAL: Strict timing requirements must be followed');
                }
                if (notes.includes('access') || notes.includes('restricted') || notes.includes('permit')) {
                  warnings.push('🚧 ACCESS RESTRICTIONS: Special access or permits may be required');
                }
                if (notes.includes('language') || notes.includes('translate') || notes.includes('interpreter')) {
                  warnings.push('🗣️ LANGUAGE: Translation or language assistance needed');
                }
                // Medical/health info is now handled in exceptional information section

                // Check trip purpose for additional warnings
                if (destination.includes('airport') && (destination.includes('international') || destination.includes('terminal'))) {
                  warnings.push('✈️ AIRPORT TERMINAL: Check specific terminal and international requirements');
                }
                if (destination.includes('hospital') || destination.includes('medical')) {
                  warnings.push('🏥 MEDICAL FACILITY: Special access and parking considerations');
                }
                if (destination.includes('wedding') || destination.includes('ceremony')) {
                  warnings.push('💒 WEDDING EVENT: Formal attire and timing requirements');
                }
                if (destination.includes('business') && destination.includes('meeting')) {
                  warnings.push('💼 BUSINESS MEETING: Professional presentation required');
                }
                if (destination.includes('school') || destination.includes('university')) {
                  warnings.push('🎓 EDUCATIONAL INSTITUTION: Check access restrictions and timing');
                }

                // Show warnings if any
                const warningElements = warnings.length > 0 ? warnings.map((warning, index) => (
                  <Card key={index} className="bg-muted/50">
                    <CardContent className="p-4">
                      <p className="text-sm text-card-foreground font-medium">{warning}</p>
                    </CardContent>
                  </Card>
                )) : null;

                // Always show recommendations
                return (
                  <>
                    {warningElements}
                    <Card className="bg-muted/50">
                      <CardContent className="p-4">
                        <h4 className="text-base font-bold text-card-foreground mb-3">Recommendations for the Driver</h4>
                        <div className="space-y-2">
                          {executiveReport.recommendations.map((rec: string, idx: number) => (
                            <div key={idx} className="flex items-start gap-3">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-card-foreground">
                                {idx + 1}
                              </span>
                              <p className="text-sm text-muted-foreground leading-relaxed">{rec}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                );
              })()}


            </div>
              </CardContent>
            </Card>
          )}

          {/* Executive Report */}
          {executiveReport && !isLiveMode && (
            <>
              {/* Debug: Log executive report data */}
              {console.log('🔍 Executive Report Data:', executiveReport)}
              {console.log('🔍 Recommendations:', executiveReport.recommendations)}
              {console.log('🔍 Highlights:', executiveReport.highlights)}
              {console.log('🔍 Exceptional Info:', executiveReport.exceptionalInformation)}
              {console.log('🔍 Important Info:', executiveReport.importantInformation)}




              {/* Potential Trip Disruptions */}
              <Card className="mb-6">
                <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-card-foreground mb-6 flex items-center gap-2">
                  <svg className="w-5 h-5" style={{ color: '#9e201b' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  Potential Trip Disruptions
                </h3>

                {/* 2 Subboxes: Top Disruptor and Risk Score */}
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                    <h4 className="text-base font-bold text-card-foreground mb-3">
                      Top Disruptor
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                  {executiveReport.topDisruptor}
                </p>
                    </CardContent>
              </Card>
                  
                  {/* Risk Score */}
                  <Card className="bg-muted/50">
                    <CardContent className="p-4 text-center">
                    <h4 className="text-base font-bold text-card-foreground mb-3">
                      Risk Score
                    </h4>
                    <div 
                      className="text-4xl font-bold mb-2"
                      style={{
                        color: (() => {
                          const riskScore = Math.max(0, executiveReport.tripRiskScore);
                          if (riskScore <= 3) return '#3ea34b'; // Success green ([#3ea34b])
                          if (riskScore <= 6) return '#db7304'; // Warning orange
                          return '#9e201b'; // Error red
                        })()
                      }}
                    >
                      {Math.max(0, executiveReport.tripRiskScore)}
                    </div>
                    <div className="text-sm text-muted-foreground font-medium mb-2">
                      out of 10
                    </div>
                    <div 
                      className="text-xs font-semibold tracking-wide px-3 py-1 rounded"
                      style={{
                        backgroundColor: (() => {
                          const riskScore = Math.max(0, executiveReport.tripRiskScore);
                          if (riskScore <= 3) return '#3ea34b'; // Success green ([#3ea34b])
                          if (riskScore <= 6) return '#db7304'; // Warning orange
                          return '#9e201b'; // Error red
                        })(),
                        color: '#FFFFFF'
                      }}
                    >
                      {Math.max(0, executiveReport.tripRiskScore) <= 3 ? 'LOW RISK' :
                       Math.max(0, executiveReport.tripRiskScore) <= 6 ? 'MODERATE RISK' :
                       Math.max(0, executiveReport.tripRiskScore) <= 8 ? 'HIGH RISK' : 'CRITICAL RISK'}
                    </div>
                    </CardContent>
                  </Card>
                  </div>
                </CardContent>
            </Card>



            </>
          )}

          {/* Chronological Journey Flow */}
          {isLiveMode && (
            <div className="relative space-y-6" style={{ overflowAnchor: 'none' }}>
            {/* Live Time Display */}
            <div className="sticky top-20 mb-12 p-4 rounded-lg relative z-20 bg-[#3ea34b] border border-[#3ea34b]">
              <div className="flex items-center justify-between">
                <div className="flex items-center justify-center gap-3 flex-1">
                <div className="w-3 h-3 rounded-full bg-white animate-pulse"></div>
                <div className="text-center">
                  <div className="text-sm text-white/80 mb-1">Current Time</div>
                  <div className="text-2xl font-bold text-white">
                    {currentTime.toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </div>
                </div>
                </div>
                {/* Close Live Trip Button */}
                <button
                  onClick={stopLiveTrip}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  title="Exit Live Trip view"
                >
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            {/* Connecting Line - starts after the green box */}
            <div className="absolute left-6 w-0.5 bg-border" style={{ top: '6rem', bottom: 0 }}></div>
            {tripResults.map((result, index) => (
              <React.Fragment key={result.locationId}>
                {/* Location Hour Display */}
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-32 text-right relative">
                    {/* Timeline Dot for Location */}
                    <div className={`absolute left-2 top-0 w-8 h-8 rounded-full border-2 border-background flex items-center justify-center z-10 ${
                      isLiveMode && activeLocationIndex === index 
                        ? 'animate-live-pulse text-white' 
                        : 'bg-primary text-primary-foreground'
                    }`}>
                      <span className="text-base font-bold">{numberToLetter(index + 1)}</span>
                    </div>
                    <div className="text-base font-bold text-foreground ml-6">
                      {getLondonLocalTime(result.time)}
                    </div>
                    <div className="text-sm text-muted-foreground ml-2">
                      {index === 0 ? 'Pick up' : index === tripResults.length - 1 ? 'Drop off' : 'Resume'}
                      {isLiveMode && activeLocationIndex === index && (
                        <span className="ml-2 px-2 py-1 text-xs font-bold text-white rounded bg-[#3ea34b]">
                          LIVE
                        </span>
                      )}
                    </div>
                  </div>
                <div className="flex-1">
              <div key={result.locationId} id={`trip-breakdown-${index}`} className="rounded-md p-3 border border-border bg-background dark:bg-[#363636] text-foreground">
                {/* Header with Full Address */}
                <div className="flex items-center justify-between mb-2 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="relative" style={{ width: '30px', height: '35px' }}>
                      <svg 
                        viewBox="0 0 24 24" 
                        className="fill-foreground stroke-background"
                        strokeWidth="1.5"
                        style={{ width: '100%', height: '100%' }}
                      >
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center" style={{ paddingBottom: '4px' }}>
                        <span className="font-bold text-xs text-background">
                          {numberToLetter(index + 1)}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1">
                      
                       {/* Editable Location Name - Only for owners */}
                      {isOwner && editingLocationId === result.locationId ? (
                        <Input
                          ref={inputRef}
                          value={editingLocationName}
                          onChange={(e) => setEditingLocationName(e.target.value)}
                          onKeyDown={(e) => handleKeyPress(e, result.locationId)}
                          onBlur={() => handleSaveLocationName(result.locationId)}
                           className="text-base font-semibold bg-background/20 border-primary-foreground/30 text-primary-foreground mt-1 mb-1"
                           placeholder="Enter location name"
                          autoFocus
                        />
                      ) : (
                        <div className="flex items-center gap-2 mt-1">
                           <p className="text-base font-semibold text-foreground">
                             {locationDisplayNames[result.locationId] || `Stop ${index + 1}`}
                          </p>
                          {/* Only show edit button for owners */}
                          {isOwner && (
                            <button
                               onClick={() => handleEditLocationName(result.locationId, `Stop ${index + 1}`)}
                              className="p-1 hover:bg-muted rounded transition-colors"
                               title="Edit location name"
                            >
                              <svg className="w-4 h-4 text-muted-foreground hover:text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                      
                      {/* Full Address with Flight Info - Formatted */}
                      <div className="mt-1">
                        {(() => {
                          const fullAddr = result.fullAddress || result.locationName;
                          const { businessName, restOfAddress } = formatLocationDisplay(fullAddr);
                          const flightMap = extractFlightNumbers(driverNotes);
                          
                          // Check if this location is an airport and has flight numbers
                          const isAirport = businessName.toLowerCase().includes('airport') || 
                                          businessName.toLowerCase().includes('heathrow') ||
                                          businessName.toLowerCase().includes('gatwick') ||
                                          businessName.toLowerCase().includes('stansted') ||
                                          businessName.toLowerCase().includes('luton');
                          
                          let displayBusinessName = businessName;
                          
                          if (isAirport && Object.keys(flightMap).length > 0) {
                            // Find matching airport in flight map
                            const matchingAirport = Object.keys(flightMap).find(airport => 
                              businessName.toLowerCase().includes(airport.toLowerCase().replace(' airport', ''))
                            );
                            
                            if (matchingAirport && flightMap[matchingAirport].length > 0) {
                              const flights = flightMap[matchingAirport].join(', ');
                              displayBusinessName = `${businessName} for flight ${flights}`;
                            }
                          }
                          
                          return (
                            <>
                              <p className="text-sm font-semibold text-foreground">
                                {displayBusinessName}
                              </p>
                              {restOfAddress && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {restOfAddress}
                                </p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* Safety, Cafes, Parking Info */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#3ea34b]"></span>
                        <span>Safety: {result.data.crime.safetyScore}/100</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span>{result.data.cafes?.summary.total || 0} Cafes</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                        <span>{result.data.parking?.carParks?.length || 0} Parking</span>
                      </div>
                    </div>
                    
                    {/* Expand/Collapse Button */}
                    <button
                      onClick={() => toggleLocationExpansion(result.locationId)}
                      className="p-2 hover:bg-muted rounded transition-colors"
                      title={expandedLocations[result.locationId] ? "Collapse details" : "Expand details"}
                    >
                      <svg 
                        className={`w-5 h-5 text-foreground transition-transform ${expandedLocations[result.locationId] ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>


                {/* All Information Cards - Single Row - Only when expanded */}
                <div 
                  className={`overflow-hidden transition-all duration-500 ease-in-out ${
                    expandedLocations[result.locationId] ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                  {/* Traveller Safety */}
                  <div 
                    className="border border-border/40 rounded-md p-3"
                      style={{
                        backgroundColor: (() => {
                          const safetyScore = result.data.crime.safetyScore;
                          if (safetyScore >= 60) return '#3ea34b'; // Success green ([#3ea34b])
                          if (safetyScore >= 40) return '#db7304'; // Warning orange
                          return '#9e201b'; // Error red
                        })(),
                        borderColor: (() => {
                          const safetyScore = result.data.crime.safetyScore;
                          if (safetyScore >= 60) return '#3ea34b'; // Green-500
                          if (safetyScore >= 40) return '#db7304'; // Orange
                          return '#9e201b'; // Error red
                        })()
                      }}
                  >
                    <h4 className="font-bold text-foreground mb-2">Traveller Safety</h4>
                    <div className="flex items-center gap-2 mb-2">
                      {(() => {
                        const safetyScore = result.data.crime.safetyScore;
                        if (safetyScore >= 80) {
                          return (
                            <>
                              <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <div className="text-sm font-semibold text-foreground">Very Safe</div>
                                <div className="text-xs text-muted-foreground">Low crime area with excellent safety record</div>
                              </div>
                            </>
                          );
                        } else if (safetyScore >= 60) {
                          return (
                            <>
                              <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <div className="text-sm font-semibold text-foreground">Safe</div>
                                <div className="text-xs text-muted-foreground">Generally safe with minimal concerns</div>
                              </div>
                            </>
                          );
                        } else if (safetyScore >= 40) {
                          return (
                            <>
                              <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                              <div>
                                <div className="text-sm font-semibold text-foreground">Moderate</div>
                                <div className="text-xs text-muted-foreground">Mixed safety profile, stay aware</div>
                              </div>
                            </>
                          );
                        } else if (safetyScore >= 20) {
                          return (
                            <>
                              <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                              <div>
                                <div className="text-sm font-semibold text-foreground">Caution Advised</div>
                                <div className="text-xs text-muted-foreground">Higher crime area, extra caution needed</div>
                              </div>
                            </>
                          );
                        } else {
                          return (
                            <>
                              <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <div className="text-sm font-semibold text-foreground">High Alert</div>
                                <div className="text-xs text-muted-foreground">High crime area, avoid if possible</div>
                              </div>
                            </>
                          );
                        }
                      })()}
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground font-medium mb-1">
                        These are the 3 most common crimes in this area. Be aware.
                      </div>
                      {result.data.crime.summary.topCategories
                        .filter(cat => !cat.category.toLowerCase().includes('other'))
                        .slice(0, 3)
                        .map((cat, idx) => (
                          <div key={idx} className="text-xs text-muted-foreground">
                            {(() => {
                              const category = cat.category.toLowerCase();
                              if (category.includes('violence')) return 'Violence and assault incidents';
                              if (category.includes('theft')) return 'Theft and burglary cases';
                              if (category.includes('robbery')) return 'Robbery and street crime';
                              if (category.includes('vehicle')) return 'Vehicle-related crimes';
                              if (category.includes('drug')) return 'Drug-related offenses';
                              if (category.includes('criminal damage')) return 'Criminal damage and vandalism';
                              if (category.includes('public order')) return 'Public order disturbances';
                              if (category.includes('burglary')) return 'Burglary and break-ins';
                              if (category.includes('shoplifting')) return 'Shoplifting incidents';
                              if (category.includes('anti-social')) return 'Anti-social behavior';
                              return cat.category;
                            })()}
                          </div>
                        ))}
                    </div>
                    
                    {/* Emergency Services Links */}
                    <div className="mt-3 pt-3 border-t border-primary-foreground/20 space-y-2">
                      {result.data.emergencyServices?.policeStation ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(result.data.emergencyServices.policeStation.name)}&query_place_id=${result.data.emergencyServices.policeStation.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between text-xs text-foreground hover:underline"
                        >
                          <div>
                            <div className="font-medium">Closest Police Station</div>
                            <div className="text-muted-foreground">{Math.round(result.data.emergencyServices.policeStation.distance)}m away</div>
                          </div>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ) : (
                        <a
                          href={`https://www.google.com/maps/search/police+station+near+${encodeURIComponent(result.locationName)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between text-xs text-foreground hover:underline"
                        >
                          <span className="font-medium">Closest Police Station</span>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}

                      {result.data.emergencyServices?.hospital ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(result.data.emergencyServices.hospital.name)}&query_place_id=${result.data.emergencyServices.hospital.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between text-xs text-foreground hover:underline"
                        >
                          <div>
                            <div className="font-medium">Closest Hospital</div>
                            <div className="text-muted-foreground">{Math.round(result.data.emergencyServices.hospital.distance)}m away</div>
                          </div>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ) : (
                        <a
                          href={`https://www.google.com/maps/search/hospital+near+${encodeURIComponent(result.locationName)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between text-xs text-foreground hover:underline"
                        >
                          <span className="font-medium">Closest Hospital</span>
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Potential Disruptive Events */}
                  <div className="bg-muted/30 border border-border rounded-md p-3">
                    <h4 className="font-bold text-foreground mb-3">Potential Disruptive Events</h4>
                    {result.data.events.events.length > 0 ? (
                      <>
                        <div className="space-y-2 mb-3">
                          {result.data.events.events.slice(0, 3).map((event: any, idx: number) => (
                            <div key={idx} className="text-xs text-muted-foreground">
                              • {event.title}
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground italic pt-2 border-t border-border">
                          {result.data.events.summary.total === 1 
                            ? 'This event will be in the area. It might affect the trip. Be aware.'
                            : `These ${result.data.events.summary.total} events will be in the area. They might affect the trip. Be aware.`}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground">No events found</div>
                    )}
                  </div>

                  {/* Nearby Cafes & Parking */}
                  <div className="bg-muted/30 border border-border rounded-md p-3">
                    <h4 className="font-bold text-foreground mb-3">Nearby Cafes & Parking</h4>
                    
                    {/* Cafes Section */}
                    <div className="mb-4">
                      <h5 className="text-sm font-semibold text-foreground mb-2">Cafes</h5>
                    <div className="space-y-2">
                      {result.data.cafes?.cafes && result.data.cafes.cafes.length > 0 ? (
                        result.data.cafes.cafes
                          .filter((cafe: any) => {
                            // Calculate if cafe is open (location time - 20 minutes)
                            const locationTime = new Date(`${tripDate} ${result.time}`);
                            const checkTime = new Date(locationTime.getTime() - 20 * 60000); // Subtract 20 minutes
                            const currentHour = checkTime.getHours();
                            const currentMinute = checkTime.getMinutes();
                            const currentTimeMinutes = currentHour * 60 + currentMinute;
                            
                            // Simple business hours check (assuming 7 AM - 10 PM)
                            return currentTimeMinutes >= 420 && currentTimeMinutes <= 1320; // 7 AM to 10 PM
                          })
                            .slice(0, 2)
                          .map((cafe: any, idx: number) => {
                            return (
                              <div key={idx} className="text-xs text-primary-foreground/70 border-b border-background/20 pb-1 last:border-b-0">
                                <div className="flex items-center justify-between mb-1">
                                  <a 
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cafe.name + ' ' + result.locationName.split(',')[0])}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-primary-foreground hover:text-ring transition-colors truncate"
                                  >
                                    {cafe.name.length > 20 ? cafe.name.substring(0, 20) + '...' : cafe.name}
                                  </a>
                                  <div className="text-xs font-medium text-[#3ea34b]">
                                    Open
                                  </div>
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1">
                                    <span className="text-ring">★</span>
                                    <span>{cafe.rating}/5</span>
                                    <span className="text-primary-foreground/60">({cafe.userRatingsTotal})</span>
                                  </div>
                                  <div className="text-xs text-primary-foreground/60">
                                  {Math.round(cafe.distance)}m away
                                    </div>
                                </div>
                              </div>
                            );
                          })
                      ) : (
                        <div className="text-xs text-primary-foreground/70">No cafes found</div>
                      )}
                    </div>
                  </div>

                    {/* Parking Section */}
                    <div>
                      <h5 className="text-sm font-semibold text-primary-foreground mb-2">Parking</h5>
                      <div className="text-xs text-primary-foreground/80 mb-2">
                      {result.data.parking?.cpzInfo?.inCPZ ? 'CPZ Zone - Charges Apply' :
                       (result.data.parking?.parkingRiskScore || 5) >= 7 ? 'Limited Street Parking' : 'Good Parking Options'}
                    </div>
                    <div className="space-y-2">
                      {result.data.parking?.carParks && result.data.parking.carParks.length > 0 ? (
                          result.data.parking.carParks.slice(0, 2).map((carPark: any, idx: number) => (
                          <div key={idx} className="text-xs text-primary-foreground/70 border-b border-background/20 pb-1 last:border-b-0">
                            <div className="flex items-center justify-between mb-1">
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(carPark.name + ' ' + result.locationName.split(',')[0])}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-primary-foreground hover:text-ring transition-colors truncate"
                              >
                                {carPark.name.length > 20 ? carPark.name.substring(0, 20) + '...' : carPark.name}
                              </a>
                              <div className="text-xs text-primary-foreground/60">
                                {Math.round(carPark.distance)}m
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                <span>{carPark.operatingHours || '24/7'}</span>
                                {carPark.totalSpaces && (
                                  <span className="text-primary-foreground/60">({carPark.totalSpaces} spaces)</span>
                                )}
                              </div>
                              <div className="text-xs text-primary-foreground/60 text-right">
                                {carPark.facilities && carPark.facilities.length > 0 
                                  ? carPark.facilities.slice(0, 2).join(', ')
                                  : 'Standard'}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                          <div className="text-xs text-primary-foreground/70">No parking data available</div>
                      )}
                      {result.data.parking?.cpzInfo?.inCPZ && (
                        <div className="text-xs text-destructive-foreground border-t border-background/20 pt-1 mt-1">
                          <div className="font-semibold">CPZ: {result.data.parking.cpzInfo.zoneName || 'Controlled Zone'}</div>
                          <div>{result.data.parking.cpzInfo.operatingHours || 'Mon-Sat 8:30am-6:30pm'}</div>
                          {result.data.parking.cpzInfo.chargeInfo && (
                            <div>{result.data.parking.cpzInfo.chargeInfo}</div>
                          )}
                        </div>
                      )}
                      </div>
                    </div>
                  </div>

                  </div>
                </div>
                  </div>
                </div>
              </div>

              {/* Route Card (after each location except the last) */}
              {index < tripResults.length - 1 && trafficPredictions?.success && trafficPredictions.data && Array.isArray(trafficPredictions.data) && trafficPredictions.data[index] && (
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-32 text-right relative">
                    {/* Timeline Dot for Route */}
                    <div className="absolute left-2 top-0 w-8 h-8 rounded-full bg-card border-2 border-border flex items-center justify-center z-10">
                      <span className="text-base font-bold text-card-foreground">→</span>
                    </div>
                    <div className="text-base font-bold text-foreground ml-6">
                      {getLondonLocalTime(result.time)}
                    </div>
                    <div className="text-sm text-muted-foreground ml-2">
                      Route
                    </div>
                  </div>
                  <div className="flex-1">
                <div 
                  className="bg-card rounded-md p-8 border border-border/40"
                >
                  {/* Route Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl font-bold text-card-foreground flex items-center gap-2">
                        <span>Route: {numberToLetter(index + 1)}</span>
                        <span 
                          className="inline-block text-lg animate-[slideArrow_2s_ease-in-out_infinite]"
                        >
                          →
                        </span>
                        <span>{numberToLetter(index + 2)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div 
                        className="px-4 py-2 rounded-lg font-semibold"
                        style={{
                          backgroundColor: (() => {
                            const leg = trafficPredictions?.data?.[index];
                            if (!leg) return '#808080'; // Default gray if no data
                            const delay = Math.max(0, (leg.minutes || 0) - (leg.minutesNoTraffic || 0));
                            if (delay < 5) return '#3ea34b'; // Success green ([#3ea34b])
                            if (delay < 10) return '#db7304'; // Warning orange
                            return '#9e201b'; // Error red (white text)
                          })(),
                          color: '#FFFFFF'
                        }}
                      >
                        {(() => {
                          const leg = trafficPredictions?.data?.[index];
                          if (!leg) return 'Delay Risk: Unknown';
                          const delay = Math.max(0, (leg.minutes || 0) - (leg.minutesNoTraffic || 0));
                          if (delay < 5) return 'Delay Risk: Low';
                          if (delay < 10) return 'Delay Risk: Moderate';
                          return 'Delay Risk: High';
                        })()}
                      </div>
                      
                      {/* Expand/Collapse Button */}
                      <button
                        onClick={() => toggleRouteExpansion(`route-${index}`)}
                        className="p-2 hover:bg-secondary/50 dark:hover:bg-[#181a23] rounded transition-colors"
                        title={expandedRoutes[`route-${index}`] ? "Collapse details" : "Expand details"}
                      >
                        <svg 
                          className={`w-5 h-5 text-card-foreground transition-transform ${expandedRoutes[`route-${index}`] ? 'rotate-180' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {/* Collapsed Summary */}
                  <div 
                      className={`overflow-hidden transition-all duration-500 ease-in-out ${
                        !expandedRoutes[`route-${index}`] ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'
                      }`}
                  >
                    <div className="flex items-center justify-between text-sm text-muted-foreground py-3">
                      <div className="flex items-center gap-4">
                        {trafficPredictions.data[index] && (
                          <>
                            <div className="flex items-center gap-1">
                              <span className="text-card-foreground font-medium">Time:</span>
                              <span>{trafficPredictions.data[index].minutes || 0} min</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-card-foreground font-medium">Distance:</span>
                              <span>{trafficPredictions.data[index].distance || 'N/A'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-card-foreground font-medium">Delay:</span>
                              <span>-{Math.max(0, (trafficPredictions.data[index].minutes || 0) - (trafficPredictions.data[index].minutesNoTraffic || 0))} min</span>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground/60">
                        Click to expand
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Details */}
                  <div 
                    className={`overflow-hidden transition-all duration-500 ease-in-out ${
                      expandedRoutes[`route-${index}`] ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="pt-2">

                  {/* Route Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* Left Column - Google Maps Route Preview */}
                    <div className="rounded-lg overflow-hidden h-[200px] border border-border">
                      <GoogleTripMap 
                        height="200px"
                        compact={true}
                        locations={[
                          {
                            id: tripResults[index].locationId,
                            name: tripResults[index].locationName,
                            lat: result.data.crime.coordinates.lat,
                            lng: result.data.crime.coordinates.lng,
                            time: tripResults[index].time,
                            safetyScore: result.data.crime.safetyScore,
                          },
                          {
                            id: tripResults[index + 1].locationId,
                            name: tripResults[index + 1].locationName,
                            lat: tripResults[index + 1].data.crime.coordinates.lat,
                            lng: tripResults[index + 1].data.crime.coordinates.lng,
                            time: tripResults[index + 1].time,
                            safetyScore: tripResults[index + 1].data.crime.safetyScore,
                          }
                        ]}
                      />
                    </div>
                    
                    {/* Right Column - Address Details */}
                    <div>
                      <div className="space-y-2">
                        <div className="text-sm">
                          <span className="font-semibold text-muted-foreground">From: </span>
                          <span className="text-card-foreground">{tripResults[index].locationName}</span>
                        </div>
                        <div className="text-sm">
                          <span className="font-semibold text-muted-foreground">To: </span>
                          <span className="text-card-foreground">{tripResults[index + 1].locationName}</span>
                        </div>
                      </div>
                      {trafficPredictions?.data?.[index]?.busyMinutes && (
                        <div className="text-sm text-destructive mt-3 pt-3 border-t border-border/30">
                          Busy traffic expected: -{Math.max(0, (trafficPredictions.data[index].busyMinutes || 0) - (trafficPredictions.data[index].minutesNoTraffic || 0))} min additional delay
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Route Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    <div 
                      className="rounded-lg p-4"
                      style={{
                        backgroundColor: (() => {
                          const leg = trafficPredictions?.data?.[index];
                          if (!leg) return 'rgba(128, 128, 128, 0.2)'; // Gray if no data
                          const delay = Math.max(0, (leg.minutes || 0) - (leg.minutesNoTraffic || 0));
                          if (delay < 5) return 'rgba(62, 163, 75, 0.2)'; // Green-500 with opacity
                          if (delay < 10) return 'rgba(219, 115, 4, 0.2)'; // Orange #db7304 with opacity
                          return 'rgba(158, 32, 27, 0.2)'; // Red #9e201b with opacity
                        })()
                      }}
                    >
                      <div 
                        className="text-sm mb-1"
                        style={{
                          color: (() => {
                            const leg = trafficPredictions?.data?.[index];
                            if (!leg) return '#808080'; // Gray if no data
                            const delay = Math.max(0, (leg.minutes || 0) - (leg.minutesNoTraffic || 0));
                            if (delay < 5) return '#3ea34b'; // Success green ([#3ea34b])
                            if (delay < 10) return '#db7304'; // Warning orange
                            return '#9e201b'; // Error red - light bg
                          })()
                        }}
                      >
                        Traffic Delay
                      </div>
                      <div 
                        className="text-2xl font-bold"
                        style={{
                          color: (() => {
                            const leg = trafficPredictions?.data?.[index];
                            if (!leg) return '#808080'; // Gray if no data
                            const delay = Math.max(0, (leg.minutes || 0) - (leg.minutesNoTraffic || 0));
                            if (delay < 5) return '#3ea34b'; // Success green ([#3ea34b])
                            if (delay < 10) return '#db7304'; // Warning orange
                            return '#9e201b'; // Error red - light bg
                          })()
                        }}
                      >
                        -{(() => {
                          const leg = trafficPredictions?.data?.[index];
                          if (!leg) return '0';
                          return Math.max(0, (leg.minutes || 0) - (leg.minutesNoTraffic || 0));
                        })()} min
                      </div>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-4">
                      <div className="text-sm text-muted-foreground mb-1">Travel Time</div>
                      <div className="text-2xl font-bold text-card-foreground">
                        {trafficPredictions?.data?.[index]?.minutes || 0} min
                      </div>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-4">
                      <div className="text-sm text-muted-foreground mb-1">Distance</div>
                      <div className="text-2xl font-bold text-card-foreground">
                        {trafficPredictions?.data?.[index]?.distance || 'N/A'}
                      </div>
                    </div>
                  </div>

                  {/* Road Closures */}
                  {result.data.disruptions.disruptions.length > 0 && (
                    <div className="bg-secondary/30 rounded-lg p-4 mt-4">
                      <div className="text-sm font-semibold mb-3 text-card-foreground">Road Closures</div>
                      <div className="space-y-2 mb-3">
                        {result.data.disruptions.disruptions.slice(0, 2).map((disruption: any, idx: number) => (
                          <div key={idx} className="text-xs">
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(disruption.location)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-card-foreground hover:underline flex items-center gap-1"
                            >
                              {disruption.location}
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                            <div className="text-destructive mt-1">{disruption.severity}</div>
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground italic pt-2 border-t border-border/30">
                        Data from Transport for London
                      </div>
                    </div>
                  )}
                  
                    </div>
                  </div>
                    </div>
                  </div>
                </div>
              )}
              </React.Fragment>
            ))}
          </div>
          )}

        </div>

        {/* Shareable Link - Only for Owners */}
        {isOwner && (
          <div className="bg-secondary border border-border/40 rounded-md p-6 mb-8">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-secondary-foreground mb-1">Shareable Link</p>
                <p className="text-sm text-muted-foreground font-mono truncate">
                  {typeof window !== 'undefined' ? window.location.href : ''}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Copy this link to share with your driver
                </p>
                {tripData?.password && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs font-medium text-secondary-foreground mb-1">Password Protection</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono bg-background px-3 py-1 rounded border border-border">
                        {tripData.password}
                      </p>
                      <button
                        onClick={() => {
                          if (tripData.password) {
                            navigator.clipboard.writeText(tripData.password);
                            const button = document.getElementById('copy-password-button');
                            if (button) {
                              const originalContent = button.innerHTML;
                              button.innerHTML = `
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                </svg>
                              `;
                              button.style.color = '#3ea34b'; // Green-500
                              setTimeout(() => {
                                button.innerHTML = originalContent;
                                button.style.color = '';
                              }, 2000);
                            }
                          }
                        }}
                        id="copy-password-button"
                        className="flex-shrink-0 p-1 rounded-md hover:bg-background/20 dark:hover:bg-[#181a23] transition-colors"
                        title="Copy password"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Share this password with your driver to access the report
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    navigator.clipboard.writeText(window.location.href);
                    // Visual feedback with brand green
                    const button = document.getElementById('copy-button');
                    if (button) {
                      const originalContent = button.innerHTML;
                      button.innerHTML = `
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                      `;
                      button.style.color = '#18815A'; // Success green - light bg
                      setTimeout(() => {
                        button.innerHTML = originalContent;
                        button.style.color = '';
                      }, 2000);
                    }
                  }
                }}
                id="copy-button"
                className="flex-shrink-0 p-2 rounded-md hover:bg-background/20 dark:hover:bg-[#181a23] transition-colors"
                title="Copy link"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Request Quotes from Drivers - Only for Owners with Password Protection */}
        {isOwner && isPasswordProtected && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">Request Quotes from Drivers</h2>
              
              {tripStatus === 'confirmed' ? (
                <Alert className="mb-4 bg-muted">
                  <AlertDescription>
                    Quote requests are disabled because this trip is confirmed. Change the trip status to "Not Confirmed" to invite more drivers.
                  </AlertDescription>
                </Alert>
              ) : (
                <p className="text-muted-foreground mb-6">
                  Invite drivers to submit quotes for this trip. Each driver will receive an email with the trip details and password.
                </p>
              )}
              
              {quoteRequestSuccess && (
                <Alert className="mb-4 bg-[#3ea34b]/10 border-[#3ea34b]/30">
                  <AlertDescription className="text-[#3ea34b]">
                    ✅ {quoteRequestSuccess}
                  </AlertDescription>
                </Alert>
              )}
              
              {quoteRequestError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{quoteRequestError}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label htmlFor="allocate-driver-email" className="block text-sm font-medium mb-2">
                      Driver Email Address
                    </label>
                    <Input
                      id="allocate-driver-email"
                      type="email"
                      value={allocateDriverEmail}
                      onChange={(e) => setAllocateDriverEmail(e.target.value)}
                      placeholder="driver@company.com"
                      disabled={sendingQuoteRequest || tripStatus === 'confirmed'}
                      className={allocateDriverEmailError ? 'border-destructive' : ''}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && allocateDriverEmail && !sendingQuoteRequest && tripStatus !== 'confirmed') {
                          handleSendQuoteRequest();
                        }
                      }}
                    />
                    {allocateDriverEmailError && (
                      <p className="text-sm text-destructive mt-1">{allocateDriverEmailError}</p>
                    )}
                  </div>
                  <div className="flex items-end">
                    <Button
                      onClick={handleSendQuoteRequest}
                      disabled={sendingQuoteRequest || !allocateDriverEmail || tripStatus === 'confirmed'}
                      className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
                    >
                      {sendingQuoteRequest ? (
                        <>
                          <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Sending...
                        </>
                      ) : (
                        'Send Request'
                      )}
                    </Button>
                  </div>
                </div>
                
                {/* List of sent invitations */}
                {sentDriverEmails.length > 0 && (
                  <div className="mt-6 pt-6 border-t">
                    <h3 className="text-sm font-semibold mb-3">Quote Requests Sent ({sentDriverEmails.length})</h3>
                    <div className="space-y-2">
                      {sentDriverEmails.map((sent, index) => {
                        const hasQuote = quotes.some(q => q.email.toLowerCase() === sent.email.toLowerCase());
                        return (
                          <div 
                            key={index} 
                            className={`flex items-center justify-between p-3 rounded-md ${
                              hasQuote 
                                ? 'bg-[#3ea34b]/10 border border-[#3ea34b]/30' 
                                : 'bg-secondary/50'
                            }`}
                          >
                            <div className="flex-1">
                              <p className="text-sm font-medium">{sent.email}</p>
                              <p className="text-xs text-muted-foreground">
                                Sent {new Date(sent.sentAt).toLocaleDateString()} at {new Date(sent.sentAt).toLocaleTimeString()}
                              </p>
                            </div>
                            {hasQuote && (
                              <span className="px-2 py-1 text-xs font-bold text-white bg-[#3ea34b] rounded">
                                QUOTE RECEIVED
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quotes Table - Only for Owners */}
        {isOwner && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">Received Quotes</h2>
              {loadingQuotes ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin h-6 w-6 text-primary" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="ml-2 text-muted-foreground">Loading quotes...</span>
                </div>
              ) : quotes.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No quotes received yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b">
                      <tr>
                        <th className="text-left py-3 px-4 font-semibold text-sm">Email</th>
                        <th className="text-right py-3 px-4 font-semibold text-sm">Price</th>
                        <th className="text-left py-3 px-4 font-semibold text-sm">Currency</th>
                        <th className="text-left py-3 px-4 font-semibold text-sm">Date</th>
                        <th className="text-center py-3 px-4 font-semibold text-sm">Driver</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotes.map((quote) => {
                        const isDriver = driverEmail && driverEmail.toLowerCase() === quote.email.toLowerCase();
                        return (
                          <tr 
                            key={quote.id} 
                            className={`border-b hover:bg-secondary/50 dark:hover:bg-[#181a23] transition-colors ${
                              isDriver ? 'bg-[#3ea34b]/10 border-[#3ea34b]/30' : ''
                            }`}
                          >
                            <td className="py-3 px-4 text-sm">
                              {quote.email}
                              {isDriver && (
                                <span className="ml-2 px-2 py-1 text-xs font-bold text-white bg-[#3ea34b] rounded">
                                  DRIVER
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm text-right font-medium">
                              {quote.price.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-sm">{quote.currency}</td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">
                              {new Date(quote.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Button
                                size="sm"
                                variant={isDriver ? "outline" : "default"}
                                onClick={() => handleSetDriver(quote.email)}
                                disabled={settingDriver}
                                className={isDriver ? "border-[#3ea34b] text-[#3ea34b] hover:bg-[#3ea34b]/10" : ""}
                              >
                                {settingDriver ? (
                                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                ) : isDriver ? (
                                  '✓ Driver'
                                ) : (
                                  'Select Driver'
                                )}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* Manual Driver Form - shown always for owners */}
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-lg font-semibold mb-4">Add Driver Manually</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Set a driver email address manually. Personal emails (Gmail, Yahoo, etc.) are accepted.
                </p>
                
                {manualDriverError && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{manualDriverError}</AlertDescription>
                  </Alert>
                )}
                
                {driverEmail && (
                  <div className="mb-4 p-3 bg-[#3ea34b]/10 border border-[#3ea34b]/30 rounded-md">
                    <p className="text-sm">
                      <span className="font-semibold">Current driver:</span>{' '}
                      <span className="text-[#3ea34b]">{driverEmail}</span>
                    </p>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type="email"
                      value={manualDriverEmail}
                      onChange={(e) => handleManualDriverInputChange(e.target.value)}
                      onFocus={handleManualDriverInputFocus}
                      onBlur={() => setTimeout(() => setShowDriverSuggestions(false), 200)}
                      placeholder="driver@gmail.com or driver@company.com"
                      disabled={settingDriver}
                      className={manualDriverError ? 'border-destructive' : ''}
                    />
                    
                    {/* Autocomplete Dropdown */}
                    {showDriverSuggestions && filteredDriverSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                        {filteredDriverSuggestions.map((driver, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleSelectDriverSuggestion(driver)}
                            className="w-full text-left px-4 py-2 hover:bg-secondary/50 dark:hover:bg-[#181a23] transition-colors text-sm border-b last:border-b-0"
                          >
                            <div className="flex items-center justify-between">
                              <span>{driver}</span>
                              {driverEmail && driverEmail.toLowerCase() === driver.toLowerCase() && (
                                <span className="text-xs px-2 py-1 bg-[#3ea34b] text-white rounded">
                                  Current
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {/* Show message when no suggestions match */}
                    {showDriverSuggestions && manualDriverEmail.trim().length > 0 && filteredDriverSuggestions.length === 0 && driverSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg p-4">
                        <p className="text-sm text-muted-foreground">No matching drivers found</p>
                      </div>
                    )}
                  </div>
                  
                  <Button
                    onClick={() => handleSetDriver(manualDriverEmail)}
                    disabled={settingDriver || !manualDriverEmail.trim()}
                    className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
                  >
                    {settingDriver ? (
                      <>
                        <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Setting...
                      </>
                    ) : (
                      'Set as Driver'
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quote Submission Form - Only for Guests on Password-Protected Reports */}
        {!isOwner && isPasswordProtected && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">Add Your Quote</h2>
              <p className="text-muted-foreground mb-6">
                Submit your pricing quote for this trip. The trip owner will be able to review your offer.
              </p>
              
              {quoteSuccess && (
                <Alert className="mb-4 bg-[#3ea34b]/10 border-[#3ea34b]/30">
                  <AlertDescription className="text-[#3ea34b]">
                    ✅ {quoteSuccessMessage}
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmitQuote} className="space-y-4">
                <div>
                  <label htmlFor="quote-email" className="block text-sm font-medium mb-2">
                    Email Address
                  </label>
                  <Input
                    id="quote-email"
                    type="email"
                    value={quoteEmail}
                    onChange={(e) => setQuoteEmail(e.target.value)}
                    placeholder="your.email@company.com"
                    disabled={submittingQuote}
                    className={quoteEmailError ? 'border-destructive' : ''}
                  />
                  {quoteEmailError && (
                    <p className="text-sm text-destructive mt-1">{quoteEmailError}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="quote-price" className="block text-sm font-medium mb-2">
                      Price
                    </label>
                    <Input
                      id="quote-price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={quotePrice}
                      onChange={(e) => setQuotePrice(e.target.value)}
                      placeholder="100.00"
                      disabled={submittingQuote}
                      className={quotePriceError ? 'border-destructive' : ''}
                    />
                    {quotePriceError && (
                      <p className="text-sm text-destructive mt-1">{quotePriceError}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="quote-currency" className="block text-sm font-medium mb-2">
                      Currency
                    </label>
                    <select
                      id="quote-currency"
                      value={quoteCurrency}
                      onChange={(e) => setQuoteCurrency(e.target.value)}
                      disabled={submittingQuote}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="JPY">JPY</option>
                      <option value="CAD">CAD</option>
                      <option value="AUD">AUD</option>
                      <option value="CHF">CHF</option>
                    </select>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submittingQuote || !quoteEmail || !quotePrice}
                  className="w-full bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
                >
                  {submittingQuote ? (
                    <>
                      <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    'Submit Quote'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Guest Signup CTA - Only for guests who created this report */}
        {isGuestCreator && !guestSignupSuccess && (
          <Card className="mb-8 border border-primary/60 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardContent className="p-8">
              <div className="max-w-2xl mx-auto">
                <h2 className="text-2xl font-bold text-center mb-3">
                  🎉 Want to save this report and access it anytime?
                </h2>
                <p className="text-center text-muted-foreground mb-6">
                  Create an account now to unlock powerful features
                </p>
                
                {/* Benefits Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Edit trips anytime</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Share with links</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Get driver quotes</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Password protect</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Notify drivers</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="w-5 h-5 text-[#3ea34b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Save all trips</span>
                  </div>
                </div>

                {/* Signup Form */}
                <form onSubmit={handleGuestSignup} className="space-y-4">
                  <div>
                    <label htmlFor="guest-email" className="block text-sm font-medium mb-2">
                      Email Address
                    </label>
                    <Input
                      id="guest-email"
                      type="email"
                      value={tripData?.userEmail || ''}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      We already have your email from when you created this report
                    </p>
                  </div>

                  <div>
                    <label htmlFor="guest-password" className="block text-sm font-medium mb-2">
                      Create Password
                    </label>
                    <Input
                      id="guest-password"
                      type="password"
                      value={guestSignupPassword}
                      onChange={(e) => setGuestSignupPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      disabled={guestSignupLoading}
                      className={guestSignupError ? 'border-destructive' : ''}
                    />
                    {guestSignupError && (
                      <p className="text-sm text-destructive mt-1">{guestSignupError}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full text-lg py-6 bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
                    disabled={guestSignupLoading || !guestSignupPassword}
                  >
                    {guestSignupLoading ? (
                      <>
                        <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Creating Account...
                      </>
                    ) : (
                      <>
                        🚀 Create Account & Save Report
                      </>
                    )}
                  </Button>
                </form>

                <p className="text-xs text-center text-muted-foreground mt-4">
                  Already have an account? <a href="/login" className="text-primary hover:underline">Log in here</a>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success message after signup */}
        {guestSignupSuccess && (
          <Alert className="mb-8 bg-[#3ea34b]/10 border-[#3ea34b]/30">
            <AlertDescription className="text-[#3ea34b] text-center">
              ✅ Account created successfully! This trip is now saved to your account. Refreshing...
            </AlertDescription>
          </Alert>
        )}

        {/* Footer Navigation */}
        <div className="text-center py-8">
          <p className="text-lg font-medium text-foreground mb-4">
            Driverbrief wishes you a nice trip
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-4">
            <Button
              onClick={handlePlanNewTrip}
              variant="default"
              size="lg"
              className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
            >
              Plan New Trip
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Powered by UK Police API, TfL, Open-Meteo, OpenAI - 100% Free
          </p>
        </div>
      </div>

      {/* Status Change Confirmation Modal */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {driverEmail ? 'Notify Driver?' : 'Driver Not Allocated'}
            </DialogTitle>
            <DialogDescription>
              {driverEmail ? (
                <>
                  The trip status will be changed to <strong>{pendingStatus}</strong>.
                  <br /><br />
                  Do you want to notify the driver about this status change?
                </>
              ) : (
                <>
                  Please allocate a driver on the page before confirming the trip.
                  <br /><br />
                  You can set a driver in the "Add Driver Manually" or "Received Quotes" section below.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {driverEmail ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleConfirmStatusChange(false)}
                  disabled={updatingStatus || sendingStatusNotification}
                >
                  {updatingStatus && !sendingStatusNotification ? (
                    <>
                      <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Updating...
                    </>
                  ) : (
                    'No, Just Update Status'
                  )}
                </Button>
                <Button
                  onClick={() => handleConfirmStatusChange(true)}
                  disabled={updatingStatus || sendingStatusNotification}
                  className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
                >
                  {updatingStatus || sendingStatusNotification ? (
                    <>
                      <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {sendingStatusNotification ? 'Sending...' : 'Updating...'}
                    </>
                  ) : (
                    'Yes, Notify Driver'
                  )}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => {
                  setShowStatusModal(false);
                  setPendingStatus(null);
                }}
                className="bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
              >
                OK
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}




