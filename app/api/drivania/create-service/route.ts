import { NextRequest, NextResponse } from 'next/server';
import { createService, formatPhoneNumber, extractFBOCode } from '@/lib/drivania-api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Log the incoming request body
    console.log('📥 [Create Service API] Received request body:', JSON.stringify(body, null, 2));

    const {
      service_id,
      vehicle_id,
      passenger_name,
      contact_email,
      contact_phone,
      notes,
      child_seats,
      flight_number,
      flight_direction,
      pickup_location,
      trip_id,
    } = body;

    // Validate required fields
    if (!service_id) {
      return NextResponse.json(
        { success: false, error: 'service_id is required' },
        { status: 400 }
      );
    }

    if (!vehicle_id) {
      return NextResponse.json(
        { success: false, error: 'vehicle_id is required' },
        { status: 400 }
      );
    }

    if (!passenger_name) {
      return NextResponse.json(
        { success: false, error: 'passenger_name is required' },
        { status: 400 }
      );
    }

    if (!contact_phone) {
      return NextResponse.json(
        { success: false, error: 'contact_phone is required' },
        { status: 400 }
      );
    }

    // Format phone number
    const formattedPhone = formatPhoneNumber(contact_phone);
    if (!formattedPhone) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Generate client reference
    const timestamp = Date.now();
    const clientReference = trip_id ? `trip-${trip_id}-${timestamp}` : `service-${timestamp}`;

    // Prepare flight info if flight number is provided
    let arrivalFlightInfo: { fbo_code: string; transportation_number: string | null } | undefined;
    let departureFlightInfo: { fbo_code: string; transportation_number: string | null } | undefined;
    let fboCode: string | undefined;

    if (flight_number && pickup_location) {
      const fbo = extractFBOCode(pickup_location.name || pickup_location);
      
      if (fbo) {
        fboCode = fbo;
        const flightInfo = {
          fbo_code: fbo,
          transportation_number: flight_number || null,
        };

        if (flight_direction === 'arrival') {
          arrivalFlightInfo = flightInfo;
        } else if (flight_direction === 'departure') {
          departureFlightInfo = flightInfo;
        } else {
          // Default to arrival if direction not specified
          arrivalFlightInfo = flightInfo;
        }
      }
    } else if (pickup_location) {
      // Try to extract FBO code even without flight number
      const fbo = extractFBOCode(pickup_location.name || pickup_location);
      if (fbo) {
        fboCode = fbo;
      }
    }

    // Build contacts array
    const contacts = [
      {
        name: passenger_name,
        email: contact_email || null,
        phone_number: formattedPhone || null,
        recipient: 'to' as const,
        permissions: [
          {
            permission_name: 'booking_confirmation',
            email: true,
            sms: false,
          },
        ],
      },
    ];

    // Build service request
    const serviceRequest = {
      service_id,
      vehicle_id,
      lead_passenger: {
        name: passenger_name,
        phone_number: formattedPhone,
        email: contact_email || null,
      },
      phone_number: formattedPhone,
      comments: notes || '',
      childseats: child_seats || 0,
      boosters: 0,
      client_reference: clientReference,
      purchase_order: clientReference,
      contacts,
      ...(arrivalFlightInfo && { arrival_flight_info: arrivalFlightInfo }),
      ...(departureFlightInfo && { departure_flight_info: departureFlightInfo }),
      ...(fboCode && { fbo_code: fboCode }),
    };

    // Log the request body that will be sent to Drivania
    console.log('📤 [Create Service API] Request body to Drivania:', JSON.stringify(serviceRequest, null, 2));

    // Create service with confirm=false
    const serviceResponse = await createService(serviceRequest, false);

    console.log('✅ [Create Service API] Service created:', serviceResponse);

    return NextResponse.json({
      success: true,
      service_reference: serviceResponse.service_reference,
      status: serviceResponse.status,
    });
  } catch (error) {
    console.error('❌ [Create Service API] Error:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to create service with Drivania API';
    
    // Determine appropriate HTTP status code
    let statusCode = 500;
    if (errorMessage.includes('503') || errorMessage.includes('temporarily unavailable')) {
      statusCode = 503;
    } else if (errorMessage.includes('429') || errorMessage.includes('Too many requests')) {
      statusCode = 429;
    } else if (errorMessage.includes('401') || errorMessage.includes('credentials')) {
      statusCode = 401;
    } else if (errorMessage.includes('400') || errorMessage.includes('Invalid')) {
      statusCode = 400;
    }
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: statusCode }
    );
  }
}

