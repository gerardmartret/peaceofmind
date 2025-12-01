import { NextRequest, NextResponse } from 'next/server';
import { requestQuote, clearTokenCache } from '@/lib/drivania-api';

const BASE_URL = process.env.DRIVANIA_API_BASE_URL || 'https://publicapi.drivania.com';
const USERNAME = process.env.DRIVANIA_API_USERNAME;
const PASSWORD = process.env.DRIVANIA_API_PASSWORD;

export async function GET(request: NextRequest) {
  const results: string[] = [];
  
  const log = (message: string) => {
    console.log(message);
    results.push(message);
  };

  log('🔍 Testing Drivania API Connection\n');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check environment variables
  log('📋 Environment Variables Check:');
  log(`   Base URL: ${BASE_URL}`);
  log(`   Username: ${USERNAME ? '✅ Set' : '❌ Missing'}`);
  log(`   Password: ${PASSWORD ? '✅ Set' : '❌ Missing'}\n`);

  if (!USERNAME || !PASSWORD) {
    return NextResponse.json({
      success: false,
      error: 'Missing credentials',
      message: 'Please set DRIVANIA_API_USERNAME and DRIVANIA_API_PASSWORD in .env.local',
      results: results.join('\n'),
    }, { status: 400 });
  }

  // Test 1: Login/Authentication
  log('🔐 Test 1: Authentication');
  log('   Attempting to login...');
  
  try {
    const loginResponse = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: USERNAME,
        password: PASSWORD,
      }),
    });

    if (!loginResponse.ok) {
      const errorData = await loginResponse.json().catch(() => ({}));
      log(`   ❌ Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
      log(`   Error: ${errorData.message || 'Unknown error'}`);
      return NextResponse.json({
        success: false,
        error: 'Login failed',
        status: loginResponse.status,
        message: errorData.message || 'Unknown error',
        results: results.join('\n'),
      }, { status: loginResponse.status });
    }

    const loginData = await loginResponse.json();
    log(`   ✅ Login successful!`);
    log(`   Token: ${loginData.token.substring(0, 20)}...`);
    log(`   Token TTL: ${loginData.token_ttl}`);
    log(`   Username: ${loginData.username}\n`);
  } catch (error) {
    log(`   ❌ Login error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return NextResponse.json({
      success: false,
      error: 'Login error',
      message: error instanceof Error ? error.message : 'Unknown error',
      results: results.join('\n'),
    }, { status: 500 });
  }

  // Test 2: Quote Request
  log('💰 Test 2: Quote Request');
  log('   Requesting a test quote...');
  
  // Clear token cache to force fresh login
  clearTokenCache();

  try {
    // Simple test quote: London to Heathrow Airport
    const testQuoteRequest = {
      service_type: 'one-way' as const,
      pickup: {
        name: 'London Paddington Station',
        latitude: 51.5154,
        longitude: -0.1755,
        location_type: 'train-station' as const,
        datetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19), // Tomorrow
      },
      dropoff: {
        name: 'Heathrow Airport',
        latitude: 51.4700,
        longitude: -0.4543,
        location_type: 'airport' as const,
        datetime: null,
      },
      passengers_number: 2,
    };

    log('   Quote request details:');
    log(`     Service: ${testQuoteRequest.service_type}`);
    log(`     Pickup: ${testQuoteRequest.pickup.name} (${testQuoteRequest.pickup.latitude}, ${testQuoteRequest.pickup.longitude})`);
    log(`     Dropoff: ${testQuoteRequest.dropoff.name} (${testQuoteRequest.dropoff.latitude}, ${testQuoteRequest.dropoff.longitude})`);
    log(`     Passengers: ${testQuoteRequest.passengers_number}`);
    log(`     Pickup time: ${testQuoteRequest.pickup.datetime}\n`);

    const quoteResponse = await requestQuote(testQuoteRequest);

    log('   ✅ Quote received successfully!');
    log(`   Service ID: ${quoteResponse.service_id}`);
    log(`   Currency: ${quoteResponse.currency_code || 'N/A'}`);
    if (quoteResponse.distance) {
      log(`   Distance: ${quoteResponse.distance.quantity} ${quoteResponse.distance.uom}`);
    }
    if (quoteResponse.drive_time) {
      log(`   Drive time: ${quoteResponse.drive_time}`);
    }
    log(`   Vehicles available: ${quoteResponse.quotes?.vehicles?.length || 0}`);
    
    if (quoteResponse.quotes?.vehicles && quoteResponse.quotes.vehicles.length > 0) {
      log('\n   Available vehicles:');
      quoteResponse.quotes.vehicles.forEach((vehicle, index) => {
        log(`     ${index + 1}. ${vehicle.vehicle_type} - ${vehicle.level_of_service}`);
        log(`        Price: ${quoteResponse.currency_code || ''} ${vehicle.sale_price.price.toFixed(2)}`);
        log(`        Capacity: ${vehicle.max_seating_capacity} passengers`);
        if (vehicle.unavailable_reason) {
          log(`        ⚠️  Unavailable: ${vehicle.unavailable_reason}`);
        }
      });
    } else if (quoteResponse.quotes?.unavailable_reason) {
      log(`   ⚠️  Quote unavailable: ${quoteResponse.quotes.unavailable_reason}`);
    }
    
    log(`   Expires at: ${quoteResponse.expiration}\n`);

    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('✅ All tests passed! Connection to Drivania API is working.\n');

    return NextResponse.json({
      success: true,
      message: 'Connection test successful',
      results: results.join('\n'),
      quote: {
        service_id: quoteResponse.service_id,
        currency: quoteResponse.currency_code,
        distance: quoteResponse.distance,
        drive_time: quoteResponse.drive_time,
        vehicle_count: quoteResponse.quotes?.vehicles?.length || 0,
        vehicles: quoteResponse.quotes?.vehicles?.map(v => ({
          vehicle_type: v.vehicle_type,
          level_of_service: v.level_of_service,
          price: v.sale_price.price,
          capacity: v.max_seating_capacity,
        })) || [],
      },
    });
  } catch (error) {
    log(`   ❌ Quote request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    if (error instanceof Error && error.stack) {
      log(`   Stack: ${error.stack}`);
    }
    return NextResponse.json({
      success: false,
      error: 'Quote request failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      results: results.join('\n'),
    }, { status: 500 });
  }
}

