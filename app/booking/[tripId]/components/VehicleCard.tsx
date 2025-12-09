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
  selectedVehicle: Vehicle | null;
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
  selectedVehicle,
  onDriverToggle,
  onSelect,
  calculatePrice,
}: VehicleCardProps) {
  const vehicleId = vehicle.vehicle_id || `${vehicle.vehicle_type}-${index}`;
  const isSelected = selectedVehicle ? (
    selectedVehicle.vehicle_id === vehicle.vehicle_id ||
    (selectedVehicle.vehicle_type === vehicle.vehicle_type && 
     selectedVehicle.level_of_service === vehicle.level_of_service)
  ) : false;
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

  const basePrice = vehicle.sale_price?.price || 0;
  const { extraFare, totalPrice } = calculatePrice(basePrice, selection.selectedDriverIds.length);

  const formatPrice = (price: number) => {
    return currencyCode ? `${currencyCode} ${price.toFixed(2)}` : price.toFixed(2);
  };

  return (
    <Card className="shadow-none w-full transition-all border-2 border-border hover:border-primary/50 dark:hover:border-primary/40">
      <CardContent className="flex flex-col gap-2 sm:gap-3 py-2 sm:py-3 px-3 sm:px-3">
        <div className="p-2 sm:p-3 flex flex-col sm:flex-row gap-2.5 sm:gap-3 border rounded-md border-border/50 bg-muted/30">
          {vehicle.vehicle_image && (
            <div className="h-24 w-full sm:h-28 sm:w-40 flex-shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted/60 sm:mx-0">
              <img
                src={vehicle.vehicle_image}
                alt={vehicle.vehicle_type}
                className="h-full w-full object-contain"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
          <div className="flex flex-1 flex-col gap-1.5 sm:gap-2">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 sm:gap-2">
              <div className="flex-1">
                <h4 className="text-lg sm:text-lg font-semibold text-card-foreground">
                  {vehicle.vehicle_type}
                </h4>
                <p className="text-sm sm:text-sm text-muted-foreground">
                  {vehicle.level_of_service}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-lg sm:text-lg font-semibold text-card-foreground">
                  {formatPrice(basePrice)}
                </div>
                {selection.isVehicleSelected && (
                  <span className="text-xs sm:text-xs text-green-600 dark:text-green-400">Discounted</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {vehicle.max_seating_capacity != null && (
                <span>Seats: {vehicle.max_seating_capacity}</span>
              )}
              {vehicle.max_cargo_capacity != null && (
                <>
                  <span className="text-muted-foreground/40">•</span>
                  <span>Cargo: {vehicle.max_cargo_capacity}</span>
                </>
              )}
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

        {(selection.selectedDriverIds.length > 0 || vehicle.extra_hour) && (
          <div className="flex flex-col gap-1 text-xs sm:text-sm text-muted-foreground px-1 sm:px-2">
            {selection.selectedDriverIds.length > 0 && extraFare > 0 && (
              <div className="flex items-center justify-between text-xs sm:text-xs">
                <span>Extra fare</span>
                <span>{formatPrice(extraFare)}</span>
              </div>
            )}
            {selection.selectedDriverIds.length > 0 && (
              <div className="flex items-center justify-between text-card-foreground font-semibold border-t border-border pt-1.5">
                <span className="text-sm sm:text-sm">Total</span>
                <span className="text-base sm:text-base">{formatPrice(totalPrice)}</span>
              </div>
            )}
            {vehicle.extra_hour && (
              <div className="text-xs sm:text-xs text-muted-foreground/80">
                Extra hour: {vehicle.extra_hour.toFixed(2)} {currencyCode}
              </div>
            )}
          </div>
        )}
        
        <div className="flex items-center justify-end sm:justify-end pt-0.5">
          <Button
            size="sm"
            type="button"
            disabled={isSelected}
            className="w-full sm:w-auto bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A] text-sm sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed sm:min-w-[120px] h-10 sm:h-8"
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
            {isSelected ? 'Selected' : 'Select'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
