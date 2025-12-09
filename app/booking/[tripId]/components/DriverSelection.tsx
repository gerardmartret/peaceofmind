import type { VehicleSelection } from '../hooks/useVehicleSelection';

interface Driver {
  id: string;
  first_name: string;
  vehicle_type: string;
  level_of_service: string | null;
  destination?: string;
  image_url?: string | null;
}

interface DriverSelectionProps {
  drivers: Driver[];
  vehicleType: string;
  vehicleLevelOfService: string;
  vehicleId: string;
  selection: VehicleSelection;
  onDriverToggle: (vehicleId: string, driverId: string) => void;
}

export function DriverSelection({
  drivers,
  vehicleType,
  vehicleLevelOfService,
  vehicleId,
  selection,
  onDriverToggle,
}: DriverSelectionProps) {
  if (drivers.length === 0) return null;

  return (
    <div className="p-3 sm:p-5 border border-border rounded-md">
      <div className="text-xs text-muted-foreground space-y-2 sm:space-y-3">
        <p className="uppercase tracking-wider text-[10px] font-semibold text-muted-foreground/80 text-center sm:text-left">
          Or select individual drivers
        </p>
        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
          {drivers.map((driver) => {
            const isDriverSelected = selection.selectedDriverIds.includes(driver.id);
            return (
              <div
                key={driver.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onDriverToggle(vehicleId, driver.id);
                }}
                className={`flex items-center gap-2 sm:gap-3 rounded-md border-2 px-2 sm:px-3 py-1.5 sm:py-2 cursor-pointer transition-all w-full sm:w-auto ${
                  isDriverSelected
                    ? 'border-primary bg-primary/10 dark:bg-primary/20 ring-2 ring-primary/30 dark:ring-primary/40 shadow-md dark:shadow-primary/20'
                    : 'border-border/60 bg-muted/60 hover:border-primary/50 dark:hover:border-primary/40'
                }`}
              >
                <div className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 overflow-hidden rounded-full bg-muted/70">
                  {driver.image_url ? (
                    <img
                      src={driver.image_url}
                      alt={driver.first_name}
                      width={48}
                      height={48}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                      fetchPriority="low"
                      onError={(event) => {
                        (event.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase text-muted-foreground">
                      ?
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-[10px] sm:text-[11px] text-muted-foreground">
                  <p className="text-xs sm:text-sm font-semibold text-card-foreground truncate">
                    {driver.first_name}
                  </p>
                  <p className="truncate text-[10px] sm:text-[11px]">
                    {driver.vehicle_type || 'Vehicle'}
                    {driver.vehicle_type && driver.destination ? ' • ' : ''}
                    {driver.destination}
                  </p>
                  <p className="text-[9px] sm:text-[10px] uppercase tracking-wide text-muted-foreground/60">
                    Supabase driver
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
