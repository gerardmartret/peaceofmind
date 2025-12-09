import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface Vehicle {
  vehicle_type: string;
  level_of_service: string;
  vehicle_image?: string;
  max_seating_capacity?: number;
  sale_price?: { price: number };
}

interface BookingSummaryCardProps {
  selectedVehicle: Vehicle | null;
  currencyCode?: string;
  onRemove: () => void;
  onContinue: () => void;
}

export function BookingSummaryCard({
  selectedVehicle,
  currencyCode,
  onRemove,
  onContinue,
}: BookingSummaryCardProps) {
  const formatPrice = (price: number) => {
    return currencyCode ? `${currencyCode} ${price.toFixed(2)}` : price.toFixed(2);
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-lg sm:text-xl font-semibold">Booking Summary</h2>
          {selectedVehicle && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              aria-label="Remove selected vehicle"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {selectedVehicle ? (
          <div className="space-y-3 sm:space-y-4">
            {selectedVehicle.vehicle_image && (
              <div className="w-full aspect-square max-w-[200px] sm:max-w-none mx-auto sm:mx-0 overflow-hidden rounded-md border border-border/70 bg-muted/60">
                <img
                  src={selectedVehicle.vehicle_image}
                  alt={selectedVehicle.vehicle_type}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            
            <div className="text-center sm:text-left">
              <h3 className="font-semibold text-card-foreground text-base sm:text-lg">
                {selectedVehicle.vehicle_type}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {selectedVehicle.level_of_service}
              </p>
            </div>

            {selectedVehicle.max_seating_capacity != null && (
              <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                <span>Seats: {selectedVehicle.max_seating_capacity}</span>
              </div>
            )}

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
            >
              Continue
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a vehicle to see booking summary
          </p>
        )}
      </CardContent>
    </Card>
  );
}
