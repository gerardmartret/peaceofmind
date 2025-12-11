export const bookingPreviewInitialState = {
  passengerName: '',
  contactEmail: '',
  leadPassengerEmail: '',
  contactPhone: '',
  flightNumber: '',
  flightDirection: '',
  passengerCount: 1,
  childSeats: 0,
  pickupTime: '',
  dropoffTime: '',
  notes: '',
};

export type BookingPreviewFieldKey = keyof typeof bookingPreviewInitialState;

export const requiredFields: BookingPreviewFieldKey[] = [
  'passengerName',
  'contactEmail',
  'leadPassengerEmail',
  'flightDirection',
  'pickupTime',
  'dropoffTime',
];

export const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'SGD'] as const;

