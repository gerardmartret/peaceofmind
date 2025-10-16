import { NextResponse } from 'next/server';
import { getParkingInfo } from '@/lib/tfl-parking-api';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const location = searchParams.get('location');

    // Validate required parameters
    if (!lat || !lng || !location) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: lat, lng, location',
      }, { status: 400 });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    // Validate coordinates
    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid coordinates provided',
      }, { status: 400 });
    }

    // Get parking information
    const parkingData = await getParkingInfo(latitude, longitude, location);

    return NextResponse.json({
      success: true,
      data: parkingData,
      message: 'Parking information retrieved successfully',
    });
  } catch (error: any) {
    console.error('❌ Error in parking API route:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch parking information',
    }, { status: 500 });
  }
}

