import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Calendar, Users } from 'lucide-react';

interface Vehicle {
  vehicle_type: string;
  level_of_service: string;
  vehicle_image?: string;
  max_seating_capacity?: number;
  sale_price?: { price: number };
}

interface TripData {
  lead_passenger_name?: string | null;
  trip_destination?: string | null;
  trip_date?: string | null;
  passenger_count?: number | null;
  locations?: Array<{ time?: string }>;
}

interface BookingSummaryCardProps {
  selectedVehicle: Vehicle | null;
  tripData: TripData | null;
  currencyCode?: string;
  onRemove: () => void;
  onContinue: () => void;
  buttonLabel?: string;
  buttonDisabled?: boolean;
  buttonLoading?: boolean;
}

export function BookingSummaryCard({
  selectedVehicle,
  tripData,
  currencyCode,
  onRemove,
  onContinue,
  buttonLabel = 'Continue',
  buttonDisabled = false,
  buttonLoading = false,
}: BookingSummaryCardProps) {
  const formatPrice = (price: number) => {
    return currencyCode ? `${currencyCode} ${price.toFixed(2)}` : price.toFixed(2);
  };

  // Calculate trip duration from locations
  const calculateDuration = () => {
    if (!tripData?.locations || tripData.locations.length < 2) return null;
    
    const firstTime = tripData.locations[0]?.time || '00:00';
    const lastTime = tripData.locations[tripData.locations.length - 1]?.time || '00:00';
    
    const [firstHours, firstMinutes] = firstTime.split(':').map(Number);
    const [lastHours, lastMinutes] = lastTime.split(':').map(Number);
    
    const firstTotalMinutes = firstHours * 60 + firstMinutes;
    const lastTotalMinutes = lastHours * 60 + lastMinutes;
    
    const durationMinutes = lastTotalMinutes - firstTotalMinutes;
    const hours = Math.floor(durationMinutes / 60);
    
    return hours > 0 ? `${hours}h` : null;
  };

  // Format trip date
  const formatTripDate = () => {
    if (!tripData?.trip_date) return null;
    
    try {
      const date = new Date(tripData.trip_date);
      const options: Intl.DateTimeFormatOptions = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      };
      return date.toLocaleDateString('en-US', options);
    } catch {
      return tripData.trip_date;
    }
  };

  const duration = calculateDuration();
  const formattedDate = formatTripDate();
  const passengerName = tripData?.lead_passenger_name || 'Passenger';
  const destination = tripData?.trip_destination || 'Destination';
  const passengerCount = tripData?.passenger_count || 1;

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Booking Summary</h2>
        
        {/* Trip Info - Always shown */}
        <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
          {/* Trip Overview */}
          <div>
            <p className="text-base sm:text-lg font-semibold text-card-foreground">
              {passengerName} (x{passengerCount}){duration ? ` ${duration}` : ''} in {destination}
            </p>
          </div>

          {/* Trip Date */}
          {formattedDate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 flex-shrink-0" />
              <span>Trip Date {formattedDate}</span>
            </div>
          )}

          {/* Number of Passengers */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4 flex-shrink-0" />
            <span>Number of Passengers {passengerCount}</span>
          </div>

          {/* What's Included */}
          <div className="pt-3 sm:pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-card-foreground mb-2">Included with Chauffs</h3>
            <ul className="space-y-1.5 text-xs sm:text-sm">
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400 mt-0.5">•</span>
                <span className="text-green-600 dark:text-green-400">24/7 Customer Support</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400 mt-0.5">•</span>
                <span className="text-green-600 dark:text-green-400">Service Guarantee</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400 mt-0.5">•</span>
                <span className="text-green-600 dark:text-green-400">Professional Licensed Drivers</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400 mt-0.5">•</span>
                <span className="text-green-600 dark:text-green-400">Fully Insured Vehicles</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400 mt-0.5">•</span>
                <span className="text-green-600 dark:text-green-400">Real-time Trip Tracking</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Vehicle Info - Only shown when vehicle is selected */}
        {selectedVehicle && (
          <div className="space-y-3 sm:space-y-4 pt-3 sm:pt-4 border-t border-border">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <h3 className="font-semibold text-card-foreground text-base sm:text-lg">
                  {selectedVehicle.vehicle_type}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {selectedVehicle.level_of_service}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRemove}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
                aria-label="Remove selected vehicle"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="pt-3 sm:pt-4 border-t border-border">
              <div className="flex items-center justify-between text-card-foreground font-semibold">
                <span className="text-sm sm:text-base">Total</span>
                <span className="text-base sm:text-lg">
                  {formatPrice(selectedVehicle.sale_price?.price || 0)}
                </span>
              </div>
            </div>

            <Button
              className="w-full bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] text-sm sm:text-base"
              onClick={onContinue}
              disabled={buttonDisabled}
            >
              {buttonLoading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Processing...
                </>
              ) : (
                buttonLabel
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
