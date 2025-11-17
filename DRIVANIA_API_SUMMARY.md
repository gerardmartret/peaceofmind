# Drivania API Integration Summary

## Overview
- **API Version**: 0.3.7
- **Documentation**: https://app.swaggerhub.com/apis/Drivania-Chauffeurs/drivania-public-booking-api/0.3.7
- **Contact**: support@drivania.com

## Base URLs

### Production
- **Production**: `https://publicapi.drivania.com`
- **Pre-production**: `https://preaws-publicapi.drivania.com`
- **Mock Server**: `https://virtserver.swaggerhub.com/Drivania-Chauffeurs/drivania-public-booking-api/0.3.7`

## Authentication

### Login Endpoint
- **Method**: `POST /login`
- **Request Body**:
  ```json
  {
    "username": "string (email)",
    "password": "string"
  }
  ```
- **Response**:
  ```json
  {
    "token": "string (JWT token)",
    "token_ttl": "string (date-time, expiration)",
    "username": "string"
  }
  ```
- **Usage**: Include `Authorization: Bearer {token}` header in all subsequent requests
- **Note**: The actual API returns `token` instead of `auth_key` as specified in the OpenAPI spec

## API Endpoints

### Authentication
- `POST /login` - Get authentication token

### Booking
- `POST /quote-requests` - Request quotation for a service
- `POST /services` - Create and confirm a service
- `POST /special-requests` - Request special service (manual quotation)
- `POST /special-requests/{service_reference}/confirm` - Confirm special request

### Service Management
- `GET /services/{service_reference}` - Get service details
- `PUT /services/{service_reference}` - Update service
- `PUT /services/{service_reference}/changes/{change_id}` - Confirm service changes
- `DELETE /services/{service_reference}` - Cancel service
- `PUT /services/{service_reference}/cancellations/{cancellation_id}` - Confirm cancellation with fees

### Tracking & Invoicing
- `GET /services/{service_reference}/driver-position` - Get real-time driver location
- `GET /services/{service_reference}/invoice/{invoice_number}` - Download invoice PDF

### Search & Lists
- `GET /service-references` - List services (with optional filters: `from`, `to`, `status`)
- `GET /fbos?icao={ICAO}` - Get FBOs at an airport

### Client Management
- `GET /clients?name={name}` - Search clients (min 3 characters)
- `POST /clients` - Create new client

## Key Data Models

### Stop (Location)
```typescript
{
  name: string;                    // e.g., "BCN LEBL Barcelona El Prat", "Hotel Hilton"
  latitude: number;
  longitude: number;
  location_type: "airport" | "hotel" | "train-station" | "other";
  datetime: string | null;        // Format: "YYYY-MM-DD HH:MM" (local time, no timezone)
}
```

### Service Basic Information
```typescript
{
  service_type: "one-way" | "hourly";
  pickup: Stop;
  dropoff: Stop;
  client_code?: string;           // Optional, links service to client
}
```

### Service Advanced Information
```typescript
{
  lead_passenger: {
    name: string;
    phone_number: string;         // With country code, numbers only
    email: string | null;
  };
  phone_number: string;           // Main contact phone
  comments: string;
  arrival_flight_info: Array<{
    fbo_code: string;
    transportation_number: string | null;  // Flight number, tail number, train number
  }>;
  departure_flight_info: Array<{
    fbo_code: string;
    transportation_number: string | null;
  }>;
  fbo_code: string;
  client_reference: string;       // Internal tracking reference
  purchase_order?: string;        // Agency record number
  contacts: Array<{
    name: string;
    email: string | null;
    phone_number: string | null;
    recipient: "to" | "cc" | "bcc";
    permissions: Array<{
      permission_name: "billing" | "booking_confirmation" | "booking_confirmation_change" | 
                       "booking_cancellation" | "booking_price_request" | "booking_quote" |
                       "chauffeur_details" | "chauffeur_on_location" | "chauffeur_on_the_way" |
                       "passenger_dropoff" | "passenger_on_board" | "vehicle_eta_to_destination";
      email: boolean;
      sms: boolean;
    }>;
  }>;
  childseats?: number;            // 0-5
  boosters?: number;               // 0-5
}
```

### Quote Request
```typescript
POST /quote-requests
{
  ...ServiceBasicInformation,
  passengers_number: number;      // Minimum 1
  client_code?: string;
}
```

### Create Service
```typescript
POST /services
{
  service_id: string;             // Format: "PR{number}" (from quote response)
  vehicle_id: string;             // Format: "V{number}" (from quote)
  confirm: boolean;
  childseats?: number;            // 0-5
  boosters?: number;              // 0-5
  ...ServiceAdvancedInformation
}
```

### Service Status
- `"requested"` - Special request initiated, awaiting manual quotation
- `"quoted"` - Service quoted, ready to confirm
- `"confirmed"` - Service confirmed
- `"cancelled"` - Service cancelled
- `"in_service"` - Service started (driver en route)
- `"invoicing"` - Service completed, invoice pending
- `"completed"` - Service finalized, invoice issued

### Vehicle Status
- `"on_my_way"` - Driver en route to pickup
- `"chauffeur_onlocation"` - Driver arrived at pickup
- `"passenger_onboard"` - Passenger in vehicle
- `"passenger_dropoff"` - Passenger arrived at destination

### Quote Response
```typescript
{
  service_id: string;             // Format: "PR{number}"
  created_at: string;             // ISO date-time
  expiration_at: string;          // ISO date-time
  distance: {
    quantity: number;
    uom: string;                  // e.g., "mi"
  } | null;
  drive_time: string | null;     // Format: "HH:MM"
  currency_code: string | null;   // e.g., "USD"
  quotes: Array<{
    vehicle_id: string;           // Format: "V{number}"
    expires_at: string;           // ISO date-time
    vehicle_type: string;         // e.g., "Sedan"
    level_of_service: string;     // e.g., "Business Premium"
    vehicle_examples: string;      // e.g., "Audi A6, Mercedes E Class..."
    max_seating_capacity: number;
    max_cargo_capacity: number;
    sale_price: {
      price: number;
      discount_rate: number;       // Percentage
      vat_rate: number;            // Percentage
    };
    extra_hour: number;
    pickup_instructions: string;
    cancellation_policy: string;
    vehicle_image: string;         // URL
    unavailable_reason?: "NOTFREQUENTLYUSED_RIDE" | "URGENT_RIDE" | "PEAK_PERIOD";
  }>;
}
```

### Service Details Response
```typescript
{
  service_reference: string;       // Format: "{CODE}/{number}"
  status: ServiceStatus;
  client_code: string | null;
  vehicle_status: VehicleStatus | null;
  driver_information: {
    name: string;
    phone_number: string;
  } | null;
  vehicle_information: {
    plate_number: string;
    brand: string;
    model: string;
  } | null;
  payment_receipts: string[];      // URLs
  invoices: string[];             // Invoice numbers
  ...ServiceBasicInformation,
  ...ServiceAdvancedInformation,
  ...Quote
}
```

### Driver Position
```typescript
GET /services/{service_reference}/driver-position
Response: {
  service_reference: string;
  latitude: number;
  longitude: number;
}
```

### Client
```typescript
{
  client_code: string;            // Unique identifier
  name: string;
  country: string;                // ISO 3166-2 (2 digit) country code
  address?: string;
  postal_code?: string;
  tax_id?: string;                // Required if country is Spain
}
```

## Important Notes

### Service Updates
- Updates that don't affect price are confirmed automatically
- Updates that affect price return a `change_id` and require confirmation via `PUT /services/{service_reference}/changes/{change_id}`
- Changes requiring new quotation:
  - Service type
  - Pickup/dropoff location
  - Date/time
  - Passenger count (when exceeding vehicle capacity)
  - Vehicle type
  - Any changes with comments

### Cancellations
- Cancellations without fees: Single `DELETE` call, confirmed immediately
- Cancellations with fees: Returns `cancellation_id` and `cancellation_fee`, requires confirmation via `PUT /services/{service_reference}/cancellations/{cancellation_id}`

### Rate Limits
- Maximum 25 requests per 3 minutes (429 error if exceeded)

### Error Responses
- `400` - Bad request
- `401` - Authentication failed
- `403` - Not authorized
- `404` - Resource not found
- `429` - Too many requests
- `500` - Server error

All error responses include:
```json
{
  "message": "Error description"
}
```

## Integration Phases (from PDF)

1. **Phase 1**: Documentation and credentials delivery
2. **Phase 2**: Project planning (timeline agreement, weekly meetings)
3. **Phase 3**: Integration development (implementation, email/Teams support)
4. **Phase 4**: Validation and testing (End-to-End test plan)
5. **Phase 5**: Going live (production migration, final validation)

**Support Hours**: Monday-Friday, 06:00-15:00 UTC

