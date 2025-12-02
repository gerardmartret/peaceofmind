import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (process.env.NODE_ENV === 'development') {
      console.log('📡 [Mock Drivania Service] Received booking payload:', body);
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const responsePayload = {
      success: true,
      service_reference: 'MOCK-SERVICE-12345',
      service_id: body.service_id || 'MOCK-SERVICE-12345',
      status: 'confirmed',
      created_at: new Date().toISOString(),
      payloadReceived: body,
    };

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ [Mock Drivania Service] Booking created:', responsePayload);
    }

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ [Mock Drivania Service] Error creating booking:', error);
    }
    return NextResponse.json(
      { success: false, error: 'Failed to simulate booking creation' },
      { status: 500 }
    );
  }
}

