import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { normalizeMatchKey, matchesDriverToVehicle } from '@/app/results/[id]/utils/vehicle-helpers';
import { DriverSelection } from './DriverSelection';
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

interface VehicleCardProps {
  vehicle: Vehicle;
  index: number;
  matchingDrivers: Driver[];
  selection: VehicleSelection;
  currencyCode?: string;
  onDriverToggle: (vehicleId: string, driverId: string) => void;
  onSelect: (vehicle: Vehicle) => void;
  calculatePrice: (basePrice: number, driverCount: number) => { extraFare: number; totalPrice: number };
}

export function VehicleCard({
  vehicle,
  index,
  matchingDrivers,
  selection,
  currencyCode,
  onDriverToggle,
  onSelect,
  calculatePrice,
}: VehicleCardProps) {
  const normalizedVehicleType = normalizeMatchKey(vehicle.vehicle_type);
  
  // Filter and deduplicate drivers
  const vehicleDrivers = normalizedVehicleType
    ? (() => {
        // First filter by matching criteria
        const matched = matchingDrivers.filter((driver) => {
          const matches = matchesDriverToVehicle(
            driver.vehicle_type,
            driver.level_of_service,
            vehicle.vehicle_type,
            vehicle.level_of_service,
          );
          return matches;
        });
        
        // Deduplicate by first_name + vehicle_type + level_of_service
        const seen = new Set<string>();
        return matched.filter((driver) => {
          const key = `${driver.first_name}|${driver.vehicle_type}|${driver.level_of_service || 'null'}`;
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        });
      })()
    : [];

  const vehicleId = vehicle.vehicle_id || `${vehicle.vehicle_type}-${index}`;
  const basePrice = vehicle.sale_price?.price || 0;
  const { extraFare, totalPrice } = calculatePrice(basePrice, selection.selectedDriverIds.length);

  const formatPrice = (price: number) => {
    return currencyCode ? `${currencyCode} ${price.toFixed(2)}` : price.toFixed(2);
  };

  return (
    <Card className="shadow-none w-full">
      <CardContent className="flex flex-col gap-4 sm:gap-6 py-4 sm:py-6">
        <div className="p-3 sm:p-5 flex flex-col sm:flex-row gap-3 sm:gap-4 border-2 rounded-md border-border">
          {vehicle.vehicle_image && (
            <div className="h-24 w-24 sm:h-32 sm:w-32 flex-shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted/60 mx-auto sm:mx-0">
              <img
                src={vehicle.vehicle_image}
                alt={vehicle.vehicle_type}
                width={128}
                height={128}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
          <div className="flex flex-1 flex-col gap-2 sm:gap-3 text-center sm:text-left">
            <div>
              <h4 className="text-base sm:text-lg font-semibold text-card-foreground">
                {vehicle.vehicle_type}
              </h4>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {vehicle.level_of_service}
              </p>
            </div>
            <div className="flex flex-col gap-2 text-xs sm:text-sm text-muted-foreground">
              <div className="flex gap-4 justify-center sm:justify-start text-xs">
                {vehicle.max_seating_capacity != null && (
                  <span>Seats: {vehicle.max_seating_capacity}</span>
                )}
                {vehicle.max_cargo_capacity != null && (
                  <span>Cargo: {vehicle.max_cargo_capacity}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <DriverSelection
          drivers={vehicleDrivers}
          vehicleType={vehicle.vehicle_type}
          vehicleLevelOfService={vehicle.level_of_service}
          vehicleId={vehicleId}
          selection={selection}
          onDriverToggle={onDriverToggle}
        />

        <div className="flex flex-col gap-2 text-xs sm:text-sm text-muted-foreground px-3 sm:px-5">
          <div className="flex items-center justify-between text-card-foreground font-semibold">
            <span className="text-sm sm:text-base">Fare</span>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg">{formatPrice(basePrice)}</span>
              {selection.isVehicleSelected && (
                <span className="text-[10px] sm:text-xs text-muted-foreground">(Discounted fare)</span>
              )}
            </div>
          </div>
          {selection.selectedDriverIds.length > 0 && extraFare > 0 && (
            <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground">
              <span>Extra fare</span>
              <span>{formatPrice(extraFare)}</span>
            </div>
          )}
          {selection.selectedDriverIds.length > 0 && (
            <div className="flex items-center justify-between text-card-foreground font-semibold border-t border-border pt-2">
              <span className="text-sm sm:text-base">Total</span>
              <span className="text-base sm:text-lg">{formatPrice(totalPrice)}</span>
            </div>
          )}
          {vehicle.extra_hour && (
            <div className="text-[10px] sm:text-xs text-muted-foreground">
              Extra hour: {vehicle.extra_hour.toFixed(2)} {currencyCode}
            </div>
          )}
          <Button
            size="sm"
            type="button"
            className="w-full bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] text-sm sm:text-base"
            onClick={() => {
              const vehicleWithTotal = {
                ...vehicle,
                sale_price: {
                  ...vehicle.sale_price,
                  price: totalPrice,
                },
              };
              onSelect(vehicleWithTotal);
            }}
          >
            Select Vehicle
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
