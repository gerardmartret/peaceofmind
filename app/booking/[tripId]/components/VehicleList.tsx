import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft } from 'lucide-react';
import { VehicleCard } from './VehicleCard';
import type { VehicleSelection } from '../hooks/useVehicleSelection';

interface Driver {
  id: string;
  first_name: string;
  vehicle_type: string;
  level_of_service: string | null;
  destination?: string;
  image_url?: string | null;
}

interface Vehicle {
  vehicle_id?: string;
  vehicle_type: string;
  level_of_service: string;
  sale_price?: { price: number };
  vehicle_image?: string;
  max_seating_capacity?: number;
  max_cargo_capacity?: number;
  extra_hour?: number;
}

interface VehicleListProps {
  loading: boolean;
  error: string | null;
  quotes: any;
  displayVehicles: Vehicle[];
  otherVehicles: Vehicle[];
  showOtherVehicles: boolean;
  preferredVehicleHint?: string | null;
  preferredVehiclesCount: number;
  matchingDrivers: Driver[];
  vehicleSelections: Record<string, VehicleSelection>;
  currencyCode?: string;
  selectedVehicle: Vehicle | null;
  onToggleOtherVehicles: () => void;
  onDriverToggle: (vehicleId: string, driverId: string) => void;
  onSelectVehicle: (vehicle: Vehicle) => void;
  calculatePrice: (basePrice: number, driverCount: number) => { extraFare: number; totalPrice: number };
  onBackToTripReport: () => void;
}

export function VehicleList({
  loading,
  error,
  quotes,
  displayVehicles,
  otherVehicles,
  showOtherVehicles,
  preferredVehicleHint,
  preferredVehiclesCount,
  matchingDrivers,
  vehicleSelections,
  currencyCode,
  selectedVehicle,
  onToggleOtherVehicles,
  onDriverToggle,
  onSelectVehicle,
  calculatePrice,
  onBackToTripReport,
}: VehicleListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mr-3"></div>
        <span className="text-muted-foreground">Searching for vehicles...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertDescription>
          {error.includes('PEAK_PERIOD') || error.includes('Peak period') || error.includes('URGENT_RIDE') || error.includes('NOTFREQUENTLYUSED_RIDE') ? (
            <>
              Online booking is not available for this trip. Please contact us at{' '}
              <a href="mailto:info@drivania.com" className="underline hover:text-primary">
                info@drivania.com
              </a>{' '}
              and we will assist you.
            </>
          ) : (
            error
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (quotes && quotes.quotes?.unavailable_reason) {
    return (
      <Alert className="mb-4">
        <AlertDescription>
          {quotes.quotes.unavailable_reason === 'PEAK_PERIOD' || quotes.quotes.unavailable_reason === 'URGENT_RIDE' || quotes.quotes.unavailable_reason === 'NOTFREQUENTLYUSED_RIDE' ? (
            <>
              Online booking is not available for this trip. Please contact us at{' '}
              <a href="mailto:info@drivania.com" className="underline hover:text-primary">
                info@drivania.com
              </a>{' '}
              and we will assist you.
            </>
          ) : (
            `Quote unavailable: ${quotes.quotes.unavailable_reason}`
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (!quotes || !quotes.quotes?.vehicles) {
    return null;
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {preferredVehicleHint && preferredVehiclesCount === 0 && (
        <p className="text-xs sm:text-sm text-muted-foreground mb-2">
          Preferred vehicle ("{preferredVehicleHint}") not found; showing all available options.
        </p>
      )}
      <div className="space-y-2 sm:space-y-3">
        {displayVehicles.map((vehicle, index) => {
          const vehicleId = vehicle.vehicle_id || `${vehicle.vehicle_type}-${index}`;
          const selection = vehicleSelections[vehicleId] || { isVehicleSelected: true, selectedDriverIds: [] };
          
          return (
            <VehicleCard
              key={vehicleId}
              vehicle={vehicle}
              index={index}
              matchingDrivers={matchingDrivers}
              selection={selection}
              currencyCode={currencyCode}
              selectedVehicle={selectedVehicle}
              onDriverToggle={onDriverToggle}
              onSelect={onSelectVehicle}
              calculatePrice={calculatePrice}
            />
          );
        })}
      </div>
      {preferredVehiclesCount > 0 && otherVehicles.length > 0 && (
        <div className="space-y-1.5 sm:space-y-2">
          <Button
            variant="outline"
            onClick={onToggleOtherVehicles}
            size="sm"
            className="w-full sm:w-auto text-xs sm:text-sm"
          >
            {showOtherVehicles ? 'Hide other vehicles' : 'Show other vehicles'}
          </Button>
          {showOtherVehicles && (
            <div className="space-y-2 sm:space-y-3">
              {otherVehicles.map((vehicle, index) => {
                const vehicleId = vehicle.vehicle_id || `${vehicle.vehicle_type}-${index}`;
                const selection = vehicleSelections[vehicleId] || { isVehicleSelected: true, selectedDriverIds: [] };
                
                return (
                  <VehicleCard
                    key={vehicleId}
                    vehicle={vehicle}
                    index={index}
                    matchingDrivers={matchingDrivers}
                    selection={selection}
                    currencyCode={currencyCode}
                    selectedVehicle={selectedVehicle}
                    onDriverToggle={onDriverToggle}
                    onSelect={onSelectVehicle}
                    calculatePrice={calculatePrice}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
      
      {/* Back to Trip Report Button */}
      <div className="pt-4">
        <Button
          variant="ghost"
          onClick={onBackToTripReport}
          size="sm"
          className="w-full sm:w-auto"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">Back to Trip Report</span>
          <span className="sm:hidden">Back</span>
        </Button>
      </div>
    </div>
  );
}
