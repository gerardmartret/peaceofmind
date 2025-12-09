import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import type { BookingPreviewFieldKey } from '@/app/results/[id]/constants';

interface BookingFormProps {
  bookingFields: {
    passengerName: string;
    contactEmail: string;
    contactPhone: string;
    flightNumber: string;
    flightDirection: string;
    passengerCount: number;
    childSeats: number;
    pickupTime: string;
    dropoffTime: string;
    notes: string;
  };
  missingFields: Set<BookingPreviewFieldKey>;
  phoneError: string | null;
  onFieldChange: (field: BookingPreviewFieldKey, value: string | number) => void;
  getPhoneFieldClassName: () => string;
  highlightMissing: (field: BookingPreviewFieldKey) => string;
}

export function BookingForm({
  bookingFields,
  missingFields,
  phoneError,
  onFieldChange,
  getPhoneFieldClassName,
  highlightMissing,
}: BookingFormProps) {
  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <h2 className="text-2xl font-semibold mb-6">Booking Details</h2>

        {/* Booking Form Fields */}
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Contact phone
              <Input
                className={getPhoneFieldClassName()}
                value={bookingFields.contactPhone}
                onChange={(e) => onFieldChange('contactPhone', e.target.value)}
              />
              {phoneError && (
                <p className="mt-1.5 text-xs text-destructive/90" style={{ color: '#e38a8a' }}>
                  {phoneError}
                </p>
              )}
            </label>
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Flight number
              <Input
                className="mt-2 w-full border border-border rounded-md px-3 py-2"
                value={bookingFields.flightNumber}
                onChange={(e) => onFieldChange('flightNumber', e.target.value)}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Child seats
              <Input
                type="number"
                min={0}
                className="mt-2 w-full border border-border rounded-md px-3 py-2"
                value={bookingFields.childSeats}
                onChange={(e) => onFieldChange('childSeats', Number(e.target.value))}
              />
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Notes</label>
            <textarea
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              rows={6}
              value={bookingFields.notes}
              onChange={(e) => onFieldChange('notes', e.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
