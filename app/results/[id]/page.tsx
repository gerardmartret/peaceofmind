'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import GoogleTripMap from '@/components/GoogleTripMap';
import TripRiskBreakdown from '@/components/TripRiskBreakdown';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Car } from 'lucide-react';

// Helper function to convert numbers to letters (1 -> A, 2 -> B, etc.)
const numberToLetter = (num: number): string => {
  return String.fromCharCode(64 + num); // 65 is 'A' in ASCII
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
}

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;
  const { user, isAuthenticated } = useAuth();
  const [tripData, setTripData] = useState<TripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false);
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
  
  // Live Trip functionality state
  const [isLiveMode, setIsLiveMode] = useState<boolean>(false);
  const [activeLocationIndex, setActiveLocationIndex] = useState<number | null>(null);
  const [liveTripInterval, setLiveTripInterval] = useState<NodeJS.Timeout | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Update current time when in live mode
  useEffect(() => {
    if (isLiveMode) {
      const timeInterval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000); // Update every second

      return () => clearInterval(timeInterval);
    }
  }, [isLiveMode]);

  // Function to convert stored time to London local time
  const getLondonLocalTime = (timeString: string): string => {
    if (!timeString) return 'N/A';
    
    // Parse the time string (e.g., "18:35" or "18")
    const timeParts = timeString.split(':');
    const hours = parseInt(timeParts[0]) || 0;
    const minutes = parseInt(timeParts[1]) || 0;
    
    // Create a date for today with the specified time in London timezone
    const today = new Date();
    const londonDate = new Date(today.toLocaleString("en-US", {timeZone: 'Europe/London'}));
    londonDate.setHours(hours, minutes, 0, 0);
    
    // Format as HH:MM
    return londonDate.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/London'
    });
  };

  // Function to extract location-specific notes from driver notes
  const extractLocationNotes = (locationName: string, notes: string): string[] => {
    if (!notes || !locationName) return [];
    
    const locationNotes: string[] = [];
    const locationLower = locationName.toLowerCase();
    const notesLower = notes.toLowerCase();
    
    // Split notes into sentences and check for location mentions
    const sentences = notes.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    sentences.forEach(sentence => {
      const sentenceLower = sentence.toLowerCase();
      
      // Check if sentence mentions this location
      const locationMentioned = locationLower.split(/[,\s]+/).some(word => 
        word.length > 2 && sentenceLower.includes(word)
      ) || sentenceLower.includes(locationLower) || 
      // Check for partial matches (e.g., "Heathrow" matches "London Heathrow Airport")
      locationLower.includes(sentenceLower.split(/[,\s]+/).find(word => word.length > 2) || '');
      
      if (locationMentioned) {
        // Clean up the sentence and add it
        const cleanSentence = sentence.trim().replace(/^[-•*]\s*/, '');
        if (cleanSentence.length > 10) { // Only add meaningful notes
          locationNotes.push(cleanSentence);
        }
      }
    });
    
    return locationNotes;
  };

  // Function to extract route-specific notes from driver notes
  const extractRouteNotes = (fromLocation: string, toLocation: string, notes: string): string[] => {
    if (!notes || !fromLocation || !toLocation) return [];
    
    const routeNotes: string[] = [];
    const notesLower = notes.toLowerCase();
    
    // Split notes into sentences and check for route mentions
    const sentences = notes.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    sentences.forEach(sentence => {
      const sentenceLower = sentence.toLowerCase();
      
      // Check for route-related keywords
      const routeKeywords = ['route', 'journey', 'drive', 'travel', 'between', 'from', 'to', 'via', 'through'];
      const hasRouteKeyword = routeKeywords.some(keyword => sentenceLower.includes(keyword));
      
      // Check if sentence mentions both locations or route context
      const mentionsFrom = fromLocation.toLowerCase().split(/[,\s]+/).some(word => 
        word.length > 2 && sentenceLower.includes(word)
      );
      const mentionsTo = toLocation.toLowerCase().split(/[,\s]+/).some(word => 
        word.length > 2 && sentenceLower.includes(word)
      );
      
      if ((hasRouteKeyword || (mentionsFrom && mentionsTo)) && !sentenceLower.includes('pickup') && !sentenceLower.includes('drop off')) {
        const cleanSentence = sentence.trim().replace(/^[-•*]\s*/, '');
        if (cleanSentence.length > 10) {
          routeNotes.push(cleanSentence);
        }
      }
    });
    
    return routeNotes;
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

  // Live Trip helper functions
  const getCurrentTripTime = (): Date => {
    if (!tripData?.locations || tripData.locations.length === 0) {
      return new Date();
    }

    // Get city from first location to determine timezone
    const getCityTimezone = (): string => {
      const firstLocation = tripData.locations[0];
      if (firstLocation.name) {
        const parts = firstLocation.name.split(',');
        if (parts.length >= 2) {
          const city = parts[parts.length - 1].trim();
          const cityTimezones: { [key: string]: string } = {
            'London': 'Europe/London',
            'Paris': 'Europe/Paris',
            'New York': 'America/New_York',
            'Los Angeles': 'America/Los_Angeles',
            'Tokyo': 'Asia/Tokyo',
            'Sydney': 'Australia/Sydney',
            'Berlin': 'Europe/Berlin',
            'Madrid': 'Europe/Madrid',
            'Rome': 'Europe/Rome',
            'Amsterdam': 'Europe/Amsterdam',
            'Dublin': 'Europe/Dublin',
            'Edinburgh': 'Europe/London',
            'Manchester': 'Europe/London',
            'Birmingham': 'Europe/London',
            'Liverpool': 'Europe/London',
            'Glasgow': 'Europe/London'
          };
          return cityTimezones[city] || 'Europe/London';
        }
      }
      return 'Europe/London';
    };

    const timezone = getCityTimezone();
    const now = new Date();
    return new Date(now.toLocaleString("en-US", {timeZone: timezone}));
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

  // Check if trip is within 1 hour of starting
  const isTripWithinOneHour = (): boolean => {
    if (!tripData?.tripDate || !tripData?.locations || tripData.locations.length === 0) {
      return false;
    }

    const now = new Date();
    const tripDateTime = new Date(tripData.tripDate);
    
    // Get the timezone for the trip city (default to London)
    const getCityTimezone = () => {
      const cityTimezones: {[key: string]: string} = {
        'London': 'Europe/London',
        'Birmingham': 'Europe/London',
        'Manchester': 'Europe/London',
        'Liverpool': 'Europe/London',
        'Leeds': 'Europe/London',
        'Sheffield': 'Europe/London',
        'Bristol': 'Europe/London',
        'Newcastle': 'Europe/London',
        'Nottingham': 'Europe/London',
        'Leicester': 'Europe/London',
        'Coventry': 'Europe/London',
        'Bradford': 'Europe/London',
        'Cardiff': 'Europe/London',
        'Belfast': 'Europe/London',
        'Glasgow': 'Europe/London',
        'Edinburgh': 'Europe/London'
      };
      return cityTimezones['London'] || 'Europe/London';
    };

    const timezone = getCityTimezone();
    
    // Convert trip date to local time in the trip city
    const tripLocalTime = new Date(tripDateTime.toLocaleString("en-US", {timeZone: timezone}));
    const oneHourBefore = new Date(tripLocalTime.getTime() - 60 * 60 * 1000);
    
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
        
        if (isAuthenticated && currentUserId && tripUserId === currentUserId) {
          setIsOwner(true);
          console.log('🔐 User is the owner of this trip - editing enabled');
        } else {
          setIsOwner(false);
          console.log('👁️ User is NOT the owner - read-only mode');
        }
        
        // Transform database data to match expected TripData format
        const tripData: TripData = {
          tripDate: data.trip_date,
          userEmail: data.user_email,
          locations: data.locations as any,
          tripResults: data.trip_results as any,
          trafficPredictions: data.traffic_predictions as any,
          executiveReport: data.executive_report as any,
          passengerCount: data.passenger_count || 1,
          tripDestination: data.trip_destination || '',
          passengerNames: [], // passenger_names column doesn't exist in DB
        };

        setTripData(tripData);
        setDriverNotes(data.trip_notes || '');
        setEditedDriverNotes(data.trip_notes || '');
        setLeadPassengerName(data.lead_passenger_name || '');
        setVehicleInfo(data.vehicle || '');
        setPassengerCount(data.passenger_count || 1);
        setTripDestination(data.trip_destination || '');
        setPassengerNames([]); // passenger_names column doesn't exist in DB, set empty array
        
        // Populate location display names from database
        const displayNames: {[key: string]: string} = {};
        tripData.locations.forEach((loc: any) => {
          // Use the location name (which is now the purpose) as the display name
          if (loc.name) {
            displayNames[loc.id] = loc.name;
          }
        });
        setLocationDisplayNames(displayNames);
        
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

  const handlePlanNewTrip = () => {
    // Redirect to home for new trip
    router.push('/');
  };

  const handleModifyTrip = () => {
    // For now, just redirect to home
    // Future: could pre-fill form with current trip data
    router.push('/');
  };

  const getSafetyColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 40) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (loading) {
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

  const { tripDate, locations, tripResults, trafficPredictions, executiveReport } = tripData;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header with Navigation */}

        {/* Results Section */}
        <div className="mb-8">


          {/* Service Introduction */}
          {!isLiveMode && (
              <div className="p-8 mb-6">
                {/* Header with Passenger Information and Live Trip Button */}
                <div className="flex items-start justify-between mb-4">
                  {/* Passenger Information */}
                  <div className="flex-1">
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

                        const passengerName = passengerNames && passengerNames.length > 0 
                                            ? passengerNames[0] 
                                            : extractPassengerName(driverNotes) || 'Passenger';

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

                        const extractedPassengerCount = passengerCount || 
                                            extractPassengerCount(driverNotes) || 
                                            1;

                        // Get city from first location
                        const getCity = (): string => {
                          if (locations && locations.length > 0) {
                            const firstLocation = locations[0];
                            if (firstLocation.name) {
                              // Try to extract city from location name
                              const parts = firstLocation.name.split(',');
                              if (parts.length >= 2) {
                                return parts[parts.length - 1].trim();
                              }
                            }
                          }
                          return 'Location';
                        };

                        const city = tripDestination || getCity();
                        const passengerText = extractedPassengerCount === 1 ? 'passenger' : 'passengers';
                        
                        if (passengerNames && passengerNames.length > 0) {
                          return `${passengerNames.join(', ')} (${extractedPassengerCount} ${passengerText}) in ${city}`;
                        } else {
                          return `${passengerName} x${extractedPassengerCount} ${passengerText} in ${city}`;
                        }
                      })()}
                    </h1>
                  </div>
                  
                  {/* Live Trip Button */}
                  {(() => {
                    const now = new Date();
                    const tripDateTime = new Date(tripDate);
                    
                    // Get city from first location to determine timezone
                    const getCityTimezone = (): string => {
                      if (locations && locations.length > 0) {
                        const firstLocation = locations[0];
                        if (firstLocation.name) {
                          const parts = firstLocation.name.split(',');
                          if (parts.length >= 2) {
                            const city = parts[parts.length - 1].trim();
                            // Map major cities to their timezones
                            const cityTimezones: { [key: string]: string } = {
                              'London': 'Europe/London',
                              'Paris': 'Europe/Paris',
                              'New York': 'America/New_York',
                              'Los Angeles': 'America/Los_Angeles',
                              'Tokyo': 'Asia/Tokyo',
                              'Sydney': 'Australia/Sydney',
                              'Dubai': 'Asia/Dubai',
                              'Singapore': 'Asia/Singapore',
                              'Hong Kong': 'Asia/Hong_Kong',
                              'Mumbai': 'Asia/Kolkata',
                              'Berlin': 'Europe/Berlin',
                              'Madrid': 'Europe/Madrid',
                              'Rome': 'Europe/Rome',
                              'Amsterdam': 'Europe/Amsterdam',
                              'Barcelona': 'Europe/Madrid',
                              'Manchester': 'Europe/London',
                              'Birmingham': 'Europe/London',
                              'Edinburgh': 'Europe/London',
                              'Glasgow': 'Europe/London',
                              'Liverpool': 'Europe/London',
                              'Leeds': 'Europe/London',
                              'Sheffield': 'Europe/London',
                              'Bristol': 'Europe/London',
                              'Newcastle': 'Europe/London',
                              'Nottingham': 'Europe/London',
                              'Leicester': 'Europe/London',
                              'Coventry': 'Europe/London',
                              'Bradford': 'Europe/London',
                              'Cardiff': 'Europe/London',
                              'Belfast': 'Europe/London'
                            };
                            return cityTimezones[city] || 'Europe/London';
                          }
                        }
                      }
                      return 'Europe/London'; // Default timezone
                    };

                    const timezone = getCityTimezone();
                    
                    // Convert trip date to local time in the trip city
                    const tripLocalTime = new Date(tripDateTime.toLocaleString("en-US", {timeZone: timezone}));
                    const oneHourBefore = new Date(tripLocalTime.getTime() - 60 * 60 * 1000);
                    const isLiveTripActive = now >= oneHourBefore;
                    
                    return (
                      <button 
                        className={`px-6 py-3 font-medium rounded-xl transition-all duration-300 flex items-center gap-3 ${
                          isLiveTripActive 
                            ? 'text-white shadow-lg hover:shadow-xl transform hover:scale-105' 
                            : 'bg-muted text-muted-foreground cursor-not-allowed'
                        }`}
                        style={{
                          backgroundColor: isLiveTripActive ? '#21AB78' : undefined
                        }}
                        onClick={() => {
                          if (isLiveTripActive) {
                            if (isLiveMode) {
                              stopLiveTrip();
                            } else {
                              startLiveTrip();
                            }
                          }
                        }}
                        disabled={!isLiveTripActive}
                        title={isLiveTripActive ? 
                          (isLiveMode ? 'Stop live trip tracking' : 'Start live trip tracking') : 
                          'Live trip will be available 1 hour before departure'}
                      >
                        <div className={`w-2.5 h-2.5 rounded-full ${isLiveTripActive ? 'bg-white animate-pulse' : 'bg-muted-foreground'}`}></div>
                        <span className="text-sm font-medium">
                          {isLiveMode ? 'Stop Live Trip' : 'Live Trip'}
                        </span>
                      </button>
                    );
                  })()}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
              {/* Pickup Time */}
              <div className="rounded-md p-3" style={{ backgroundColor: '#e3e3e3' }}>
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-card-foreground">Pickup Time</span>
                </div>
                  <p className="text-2xl font-bold text-card-foreground">
                    {locations[0]?.time ? getLondonLocalTime(locations[0].time) : 'N/A'}
                  </p>
              </div>

              {/* Estimated Duration */}
              <div className="rounded-md p-3" style={{ backgroundColor: '#e3e3e3' }}>
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-sm font-medium text-card-foreground">Trip Duration</span>
                </div>
                  <p className="text-2xl font-bold text-card-foreground">
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
              </div>

              {/* Estimated Mileage */}
              <div className="rounded-md p-3" style={{ backgroundColor: '#e3e3e3' }}>
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm font-medium text-card-foreground">Estimated Distance</span>
                </div>
                  <p className="text-2xl font-bold text-card-foreground">
                    {trafficPredictions?.success && trafficPredictions.data ? 
                      trafficPredictions.data.reduce((total: number, route: any) => {
                        const distance = parseFloat(route.distance.replace(/[^\d.]/g, ''));
                        return total + (isNaN(distance) ? 0 : distance);
                      }, 0).toFixed(1) + ' miles' :
                      'Calculating...'
                    }
                  </p>
              </div>
            </div>
          )}

          {/* Trip Locations */}
          {!isLiveMode && (
            <div className="rounded-md p-6 border border-border bg-card mb-6">
            <h3 className="text-xl font-medium text-card-foreground mb-4">Trip Locations</h3>
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
                              <span className="ml-2 px-2 py-1 text-xs font-bold text-white rounded" style={{ backgroundColor: '#21AB78' }}>
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
                            className="text-lg text-card-foreground font-medium text-left hover:text-primary hover:underline transition-colors cursor-pointer block w-full truncate"
                            title={(() => {
                              const baseLocation = location.formattedAddress || location.fullAddress || location.address || location.name;
                              const flightMap = extractFlightNumbers(driverNotes);
                              const locationName = baseLocation;
                              
                              // Check if this location is an airport and has flight numbers
                              const isAirport = locationName.toLowerCase().includes('airport') || 
                                              locationName.toLowerCase().includes('heathrow') ||
                                              locationName.toLowerCase().includes('gatwick') ||
                                              locationName.toLowerCase().includes('stansted') ||
                                              locationName.toLowerCase().includes('luton');
                              
                              if (isAirport && Object.keys(flightMap).length > 0) {
                                // Find matching airport in flight map
                                const matchingAirport = Object.keys(flightMap).find(airport => 
                                  locationName.toLowerCase().includes(airport.toLowerCase().replace(' airport', ''))
                                );
                                
                                if (matchingAirport && flightMap[matchingAirport].length > 0) {
                                  const flights = flightMap[matchingAirport].join(', ');
                                  return `${baseLocation} for flight ${flights}`;
                                }
                              }
                              
                              return baseLocation;
                            })()}
                          >
                            {(() => {
                              const baseLocation = location.formattedAddress || location.fullAddress || location.address || location.name;
                              const flightMap = extractFlightNumbers(driverNotes);
                              const locationName = baseLocation;
                              
                              // Check if this location is an airport and has flight numbers
                              const isAirport = locationName.toLowerCase().includes('airport') || 
                                              locationName.toLowerCase().includes('heathrow') ||
                                              locationName.toLowerCase().includes('gatwick') ||
                                              locationName.toLowerCase().includes('stansted') ||
                                              locationName.toLowerCase().includes('luton');
                              
                              let displayText = baseLocation;
                              
                              if (isAirport && Object.keys(flightMap).length > 0) {
                                // Find matching airport in flight map
                                const matchingAirport = Object.keys(flightMap).find(airport => 
                                  locationName.toLowerCase().includes(airport.toLowerCase().replace(' airport', ''))
                                );
                                
                                if (matchingAirport && flightMap[matchingAirport].length > 0) {
                                  const flights = flightMap[matchingAirport].join(', ');
                                  displayText = `${baseLocation} for flight ${flights}`;
                                }
                              }
                              
                              // Truncate if too long (approximately 60 characters for single line)
                              if (displayText.length > 60) {
                                return displayText.substring(0, 57) + '...';
                              }
                              
                              return displayText;
                            })()}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          )}

          {/* Driver Warnings Box */}
          {!isLiveMode && (
            <div className="rounded-md p-6 border-2 border-border mb-6" style={{ backgroundColor: '#05060A' }}>
            <div className="mb-4">
              <h3 className="text-xl font-medium text-white">Driver Warnings</h3>
            </div>
            
            <div className="space-y-3">
              {/* Very Important Information */}
              {executiveReport?.exceptionalInformation && (
                <div className="rounded-md p-4" style={{ backgroundColor: '#462b2c', borderColor: '#7b2b2e', borderWidth: '1px', borderStyle: 'solid' }}>
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-white flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <div className="text-sm text-white/90 leading-relaxed">
                        {executiveReport.exceptionalInformation?.split('\n').map((point: string, index: number) => (
                          <div key={index} className="flex items-start gap-2 mb-1">
                            <span className="text-red-400 mt-1">•</span>
                            <span>{point.trim().replace(/^[-•*]\s*/, '')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Important Information */}
              {executiveReport?.importantInformation && (
                <div className="rounded-md p-4 mt-3" style={{ backgroundColor: '#2d3748', borderColor: '#4a5568', borderWidth: '1px', borderStyle: 'solid' }}>
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <h4 className="font-semibold text-white mb-1">Important Information</h4>
                      <p className="text-sm text-gray-300 leading-relaxed">{executiveReport.importantInformation}</p>
                    </div>
                  </div>
                </div>
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
                if (notes.includes('medical') || notes.includes('health') || notes.includes('assistance')) {
                  warnings.push('🏥 MEDICAL: Health considerations or assistance required');
                }

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
                  // Show driver recommendations instead of business meeting warning
                  return (
                    <div className="bg-white/10 border border-white/20 rounded-md p-4">
                      <h4 className="text-sm font-semibold text-white mb-3">Recommendations for the Driver</h4>
                      <div className="space-y-2">
                        {executiveReport.recommendations.map((rec: string, idx: number) => (
                          <div key={idx} className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold text-white">
                              {idx + 1}
                            </span>
                            <p className="text-sm text-white/90 leading-relaxed">{rec}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }
                if (destination.includes('school') || destination.includes('university')) {
                  warnings.push('🎓 EDUCATIONAL INSTITUTION: Check access restrictions and timing');
                }

                return warnings.length > 0 ? warnings.map((warning, index) => (
                  <div key={index} className="bg-white/10 border border-white/20 rounded-md p-3">
                    <p className="text-sm text-white font-medium">{warning}</p>
                  </div>
                )) : (
                  <div className="bg-white/10 border border-white/20 rounded-md p-4">
                    <h4 className="text-sm font-semibold text-white mb-3">Recommendations for the Driver</h4>
                    <div className="space-y-2">
                      {executiveReport.recommendations.map((rec: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold text-white">
                            {idx + 1}
                          </span>
                          <p className="text-sm text-white/90 leading-relaxed">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}


            </div>
          </div>
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
              {console.log('🔍 Driver Notes:', driverNotes)}




              {/* Potential Trip Disruptions */}
              <div className="rounded-md p-6 border-2 border-border bg-card mb-6">
                <h3 className="text-xl font-medium text-card-foreground mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  Potential Trip Disruptions
                </h3>

                {/* 3 Subboxes including Risk Score and Driver Notes */}
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="rounded-md p-4" style={{ backgroundColor: '#e3e3e3' }}>
                    <h4 className="text-base font-bold text-card-foreground mb-3">
                      Top Disruptor
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                  {executiveReport.topDisruptor}
                </p>
              </div>
                  
                  {/* Risk Score */}
                  <div className="rounded-md p-4 text-center" style={{ backgroundColor: '#e3e3e3' }}>
                    <h4 className="text-base font-bold text-card-foreground mb-3">
                      Risk Score
                    </h4>
                    <div 
                      className="text-4xl font-bold mb-2"
                      style={{
                        color: (() => {
                          const riskScore = Math.max(0, executiveReport.tripRiskScore);
                          if (riskScore <= 3) return '#18815A'; // Success green
                          if (riskScore <= 6) return '#D97706'; // Warning orange
                          return '#B22E2E'; // Error red
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
                          if (riskScore <= 3) return '#18815A'; // Success green
                          if (riskScore <= 6) return '#D97706'; // Warning orange
                          return '#B22E2E'; // Error red
                        })(),
                        color: '#FFFFFF'
                      }}
                    >
                      {Math.max(0, executiveReport.tripRiskScore) <= 3 ? 'LOW RISK' :
                       Math.max(0, executiveReport.tripRiskScore) <= 6 ? 'MODERATE RISK' :
                       Math.max(0, executiveReport.tripRiskScore) <= 8 ? 'HIGH RISK' : 'CRITICAL RISK'}
                    </div>
                  </div>

                  {/* Driver Notes */}
                  <div className="rounded-md p-4" style={{ backgroundColor: '#e3e3e3' }}>
                    <h4 className="text-base font-bold text-card-foreground mb-3">
                      Driver Notes
                    </h4>
                    <div className="text-sm text-muted-foreground leading-relaxed">
                      {driverNotes && driverNotes.length > 0 ? (
                        <div className="space-y-1">
                          {driverNotes.length > 200 ? (
                            <>
                              <p>{driverNotes.substring(0, 200)}...</p>
                              <p className="text-xs text-muted-foreground/70 italic">
                                +{Math.ceil((driverNotes.length - 200) / 50)} more lines
                              </p>
                            </>
                          ) : (
                            <p>{driverNotes}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground/70 italic">No driver notes available</p>
                      )}
                    </div>
                  </div>
              </div>
            </div>



            </>
          )}

          {/* Chronological Journey Flow */}
          {isLiveMode && (
            <div className="relative space-y-6" style={{ overflowAnchor: 'none' }}>
            {/* Live Time Display */}
            <div className="sticky top-20 mb-12 p-4 rounded-lg relative z-20" style={{ backgroundColor: '#21AB78', borderColor: '#21AB78', borderWidth: '1px', borderStyle: 'solid' }}>
              <div className="flex items-center justify-center gap-3">
                <div className="w-3 h-3 rounded-full bg-white animate-pulse"></div>
                <div className="text-center">
                  <div className="text-sm text-white/80 mb-1">Current Time (London)</div>
                  <div className="text-2xl font-bold text-white">
                    {currentTime.toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      timeZone: 'Europe/London'
                    })}
                  </div>
                </div>
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
                        <span className="ml-2 px-2 py-1 text-xs font-bold text-white rounded" style={{ backgroundColor: '#21AB78' }}>
                          LIVE
                        </span>
                      )}
                    </div>
                  </div>
                <div className="flex-1">
              <div key={result.locationId} id={`trip-breakdown-${index}`} className="rounded-md p-3 border-2 border-primary text-primary-foreground" style={{ backgroundColor: '#05060A' }}>
                {/* Header with Full Address */}
                <div className="flex items-center justify-between mb-2 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="relative" style={{ width: '30px', height: '35px' }}>
                      <svg 
                        viewBox="0 0 24 24" 
                        fill="white" 
                        stroke="#05060A" 
                        strokeWidth="1.5"
                        style={{ width: '100%', height: '100%' }}
                      >
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center" style={{ paddingBottom: '4px' }}>
                        <span className="font-bold text-xs" style={{ color: '#05060A' }}>
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
                           <p className="text-base font-semibold text-primary-foreground">
                             {locationDisplayNames[result.locationId] || `Stop ${index + 1}`}
                          </p>
                          {/* Only show edit button for owners */}
                          {isOwner && (
                            <button
                               onClick={() => handleEditLocationName(result.locationId, `Stop ${index + 1}`)}
                              className="p-1 hover:bg-background/20 rounded transition-colors"
                               title="Edit location name"
                            >
                              <svg className="w-4 h-4 text-primary-foreground/70 hover:text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                      
                      {/* Full Address with Flight Info */}
                      <p className="text-xs text-primary-foreground/70 mt-1">
                        {(() => {
                          const baseLocation = result.fullAddress || result.locationName;
                          const flightMap = extractFlightNumbers(driverNotes);
                          const locationName = baseLocation;
                          
                          // Check if this location is an airport and has flight numbers
                          const isAirport = locationName.toLowerCase().includes('airport') || 
                                          locationName.toLowerCase().includes('heathrow') ||
                                          locationName.toLowerCase().includes('gatwick') ||
                                          locationName.toLowerCase().includes('stansted') ||
                                          locationName.toLowerCase().includes('luton');
                          
                          if (isAirport && Object.keys(flightMap).length > 0) {
                            // Find matching airport in flight map
                            const matchingAirport = Object.keys(flightMap).find(airport => 
                              locationName.toLowerCase().includes(airport.toLowerCase().replace(' airport', ''))
                            );
                            
                            if (matchingAirport && flightMap[matchingAirport].length > 0) {
                              const flights = flightMap[matchingAirport].join(', ');
                              return `${baseLocation} for flight ${flights}`;
                            }
                          }
                          
                          return baseLocation;
                        })()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* Safety, Cafes, Parking Info */}
                    <div className="flex items-center gap-4 text-xs text-primary-foreground/80">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
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
                    
                    {/* Location-specific notes from driver notes */}
                    {(() => {
                      const locationName = locationDisplayNames[result.locationId] || `Stop ${index + 1}`;
                      const notes = extractLocationNotes(locationName, driverNotes);
                      if (notes.length > 0) {
                        // Truncate notes to fit better in the box
                        const truncatedNotes = notes.slice(0, 2); // Show only first 2 notes
                        const hasMore = notes.length > 2;
                        return (
                          <div className="mt-2 p-2 bg-background/20 rounded border border-primary-foreground/20">
                            <div className="flex items-start gap-1">
                              <svg className="w-3 h-3 text-primary-foreground/70 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <div className="flex-1">
                                <h5 className="text-xs font-semibold text-primary-foreground mb-1">Notes</h5>
                                <div className="space-y-0.5">
                                  {truncatedNotes.map((note, noteIndex) => (
                                    <p key={noteIndex} className="text-xs text-primary-foreground/80 leading-tight">
                                      • {note.length > 50 ? note.substring(0, 50) + '...' : note}
                                    </p>
                                  ))}
                                  {hasMore && (
                                    <p className="text-xs text-primary-foreground/60 italic">
                                      +{notes.length - 2} more notes
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                    {/* Expand/Collapse Button */}
                    <button
                      onClick={() => toggleLocationExpansion(result.locationId)}
                      className="p-2 hover:bg-background/20 rounded transition-colors"
                      title={expandedLocations[result.locationId] ? "Collapse details" : "Expand details"}
                    >
                      <svg 
                        className={`w-5 h-5 text-primary-foreground transition-transform ${expandedLocations[result.locationId] ? 'rotate-180' : ''}`} 
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
                    className="border-2 rounded-md p-3"
                      style={{
                        backgroundColor: (() => {
                          const safetyScore = result.data.crime.safetyScore;
                          if (safetyScore >= 60) return '#45C48A'; // Success green - dark bg
                          if (safetyScore >= 40) return '#F7A733'; // Warning orange - dark bg
                          return '#E05A5A'; // Error red - dark bg
                        })(),
                        borderColor: (() => {
                          const safetyScore = result.data.crime.safetyScore;
                          if (safetyScore >= 60) return '#45C48A';
                          if (safetyScore >= 40) return '#F7A733';
                          return '#E05A5A';
                        })()
                      }}
                  >
                    <h4 className="font-bold text-primary-foreground mb-2">Traveller Safety</h4>
                    <div className="flex items-center gap-2 mb-2">
                      {(() => {
                        const safetyScore = result.data.crime.safetyScore;
                        if (safetyScore >= 80) {
                          return (
                            <>
                              <svg className="w-5 h-5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <div className="text-sm font-semibold text-primary-foreground">Very Safe</div>
                                <div className="text-xs text-primary-foreground/80">Low crime area with excellent safety record</div>
                              </div>
                            </>
                          );
                        } else if (safetyScore >= 60) {
                          return (
                            <>
                              <svg className="w-5 h-5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <div className="text-sm font-semibold text-primary-foreground">Safe</div>
                                <div className="text-xs text-primary-foreground/80">Generally safe with minimal concerns</div>
                              </div>
                            </>
                          );
                        } else if (safetyScore >= 40) {
                          return (
                            <>
                              <svg className="w-5 h-5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                              <div>
                                <div className="text-sm font-semibold text-primary-foreground">Moderate</div>
                                <div className="text-xs text-primary-foreground/80">Mixed safety profile, stay aware</div>
                              </div>
                            </>
                          );
                        } else if (safetyScore >= 20) {
                          return (
                            <>
                              <svg className="w-5 h-5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                              <div>
                                <div className="text-sm font-semibold text-primary-foreground">Caution Advised</div>
                                <div className="text-xs text-primary-foreground/80">Higher crime area, extra caution needed</div>
                              </div>
                            </>
                          );
                        } else {
                          return (
                            <>
                              <svg className="w-5 h-5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <div className="text-sm font-semibold text-primary-foreground">High Alert</div>
                                <div className="text-xs text-primary-foreground/80">High crime area, avoid if possible</div>
                              </div>
                            </>
                          );
                        }
                      })()}
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-primary-foreground/80 font-medium mb-1">
                        These are the 3 most common crimes in this area. Be aware.
                      </div>
                      {result.data.crime.summary.topCategories
                        .filter(cat => !cat.category.toLowerCase().includes('other'))
                        .slice(0, 3)
                        .map((cat, idx) => (
                          <div key={idx} className="text-xs text-primary-foreground/70">
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
                          className="flex items-center justify-between text-xs text-primary-foreground hover:underline"
                        >
                          <div>
                            <div className="font-medium">Closest Police Station</div>
                            <div className="text-primary-foreground/70">{Math.round(result.data.emergencyServices.policeStation.distance)}m away</div>
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
                          className="flex items-center justify-between text-xs text-primary-foreground hover:underline"
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
                          className="flex items-center justify-between text-xs text-primary-foreground hover:underline"
                        >
                          <div>
                            <div className="font-medium">Closest Hospital</div>
                            <div className="text-primary-foreground/70">{Math.round(result.data.emergencyServices.hospital.distance)}m away</div>
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
                          className="flex items-center justify-between text-xs text-primary-foreground hover:underline"
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
                  <div className="bg-background/20 border-2 border-background/30 rounded-md p-3">
                    <h4 className="font-bold text-primary-foreground mb-3">Potential Disruptive Events</h4>
                    {result.data.events.events.length > 0 ? (
                      <>
                        <div className="space-y-2 mb-3">
                          {result.data.events.events.slice(0, 3).map((event: any, idx: number) => (
                            <div key={idx} className="text-xs text-primary-foreground/80">
                              • {event.title}
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-primary-foreground/70 italic pt-2 border-t border-primary-foreground/20">
                          {result.data.events.summary.total === 1 
                            ? 'This event will be in the area. It might affect the trip. Be aware.'
                            : `These ${result.data.events.summary.total} events will be in the area. They might affect the trip. Be aware.`}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-primary-foreground/70">No events found</div>
                    )}
                  </div>

                  {/* Nearby Cafes & Parking */}
                  <div className="bg-background/20 border-2 border-background/30 rounded-md p-3">
                    <h4 className="font-bold text-primary-foreground mb-3">Nearby Cafes & Parking</h4>
                    
                    {/* Cafes Section */}
                    <div className="mb-4">
                      <h5 className="text-sm font-semibold text-primary-foreground mb-2">Cafes</h5>
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
                                  <div className="text-xs font-medium" style={{ color: '#45C48A' }}>
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
              {index < tripResults.length - 1 && trafficPredictions?.success && trafficPredictions.data[index] && (
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
                  className="bg-card rounded-md p-8 border-2 border-border"
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
                            const leg = trafficPredictions.data[index];
                            const delay = Math.max(0, leg.minutes - leg.minutesNoTraffic);
                            if (delay < 5) return '#45C48A'; // Success green - dark bg (white text)
                            if (delay < 10) return '#F7A733'; // Warning orange - dark bg (white text)
                            return '#E05A5A'; // Error red - dark bg (white text)
                          })(),
                          color: '#FFFFFF'
                        }}
                      >
                        {(() => {
                          const leg = trafficPredictions.data[index];
                          const delay = Math.max(0, leg.minutes - leg.minutesNoTraffic);
                          if (delay < 5) return 'Delay Risk: Low';
                          if (delay < 10) return 'Delay Risk: Moderate';
                          return 'Delay Risk: High';
                        })()}
                      </div>
                      
                      {/* Expand/Collapse Button */}
                      <button
                        onClick={() => toggleRouteExpansion(`route-${index}`)}
                        className="p-2 hover:bg-secondary/50 rounded transition-colors"
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
                        <div className="flex items-center gap-1">
                          <span className="text-card-foreground font-medium">Time:</span>
                          <span>{trafficPredictions.data[index].minutes} min</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-card-foreground font-medium">Distance:</span>
                          <span>{trafficPredictions.data[index].distance}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-card-foreground font-medium">Delay:</span>
                          <span>-{Math.max(0, trafficPredictions.data[index].minutes - trafficPredictions.data[index].minutesNoTraffic)} min</span>
                        </div>
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
                      {trafficPredictions.data[index].busyMinutes && (
                        <div className="text-sm text-destructive mt-3 pt-3 border-t border-border/30">
                          Busy traffic expected: -{Math.max(0, trafficPredictions.data[index].busyMinutes - trafficPredictions.data[index].minutesNoTraffic)} min additional delay
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
                          const delay = Math.max(0, trafficPredictions.data[index].minutes - trafficPredictions.data[index].minutesNoTraffic);
                          if (delay < 5) return 'rgba(24, 129, 90, 0.2)'; // Brand green with opacity
                          if (delay < 10) return 'rgba(212, 145, 92, 0.2)'; // Professional orange with opacity
                          return 'rgba(173, 82, 82, 0.2)'; // Brand red with opacity
                        })()
                      }}
                    >
                      <div 
                        className="text-sm mb-1"
                        style={{
                          color: (() => {
                            const delay = Math.max(0, trafficPredictions.data[index].minutes - trafficPredictions.data[index].minutesNoTraffic);
                            if (delay < 5) return '#18815A'; // Success green - light bg
                            if (delay < 10) return '#D97706'; // Warning orange - light bg
                            return '#B22E2E'; // Error red - light bg
                          })()
                        }}
                      >
                        Traffic Delay
                      </div>
                      <div 
                        className="text-2xl font-bold"
                        style={{
                          color: (() => {
                            const delay = Math.max(0, trafficPredictions.data[index].minutes - trafficPredictions.data[index].minutesNoTraffic);
                            if (delay < 5) return '#18815A'; // Success green - light bg
                            if (delay < 10) return '#D97706'; // Warning orange - light bg
                            return '#B22E2E'; // Error red - light bg
                          })()
                        }}
                      >
                        -{Math.max(0, trafficPredictions.data[index].minutes - trafficPredictions.data[index].minutesNoTraffic)} min
                      </div>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-4">
                      <div className="text-sm text-muted-foreground mb-1">Travel Time</div>
                      <div className="text-2xl font-bold text-card-foreground">
                        {trafficPredictions.data[index].minutes} min
                      </div>
                    </div>
                    <div className="bg-secondary/50 rounded-lg p-4">
                      <div className="text-sm text-muted-foreground mb-1">Distance</div>
                      <div className="text-2xl font-bold text-card-foreground">
                        {trafficPredictions.data[index].distance}
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
                  
                  {/* Route-specific notes from driver notes */}
                  {(() => {
                    const fromLocation = tripResults[index].locationName;
                    const toLocation = tripResults[index + 1].locationName;
                    const notes = extractRouteNotes(fromLocation, toLocation, driverNotes);
                    if (notes.length > 0) {
                      // Truncate notes to fit better in the box
                      const truncatedNotes = notes.slice(0, 2); // Show only first 2 notes
                      const hasMore = notes.length > 2;
                      return (
                        <div className="mt-2 p-2 bg-secondary/30 rounded border border-border">
                          <div className="flex items-start gap-1">
                            <svg className="w-3 h-3 text-card-foreground/70 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div className="flex-1">
                              <h5 className="text-xs font-semibold text-card-foreground mb-1">Notes</h5>
                              <div className="space-y-0.5">
                                {truncatedNotes.map((note, noteIndex) => (
                                  <p key={noteIndex} className="text-xs text-card-foreground/80 leading-tight">
                                    • {note.length > 50 ? note.substring(0, 50) + '...' : note}
                                  </p>
                                ))}
                                {hasMore && (
                                  <p className="text-xs text-card-foreground/60 italic">
                                    +{notes.length - 2} more notes
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
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

        {/* Shareable Link */}
        <div className="bg-secondary border-2 border-border rounded-md p-6 mb-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-secondary-foreground mb-1">Shareable Link</p>
              <p className="text-sm text-muted-foreground font-mono truncate">
                {typeof window !== 'undefined' ? window.location.href : ''}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Copy this link to share with your driver
              </p>
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
              className="flex-shrink-0 p-2 rounded-md hover:bg-background/20 transition-colors"
              title="Copy link"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>

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
              className="text-white"
              style={{ backgroundColor: '#05060A' }}
            >
              Plan New Trip
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Powered by UK Police API, TfL, Open-Meteo, OpenAI - 100% Free
          </p>
        </div>
      </div>
    </div>
  );
}



