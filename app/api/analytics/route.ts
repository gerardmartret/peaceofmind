import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/admin-helpers';

export async function GET(request: Request) {
  try {
    // Verify admin access
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';

    // Calculate date range
    const now = new Date();
    let daysAgo = 30;
    if (timeRange === '7d') daysAgo = 7;
    else if (timeRange === '90d') daysAgo = 90;

    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysAgo);
    const startDateStr = startDate.toISOString();

    // Previous period for comparison
    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - daysAgo);
    const previousStartDateStr = previousStartDate.toISOString();

    // Fetch all data in parallel
    const [
      usersResult,
      previousUsersResult,
      tripsResult,
      previousTripsResult,
      quotesResult,
      previousQuotesResult,
      driverTokensResult,
      tripsByStatusResult,
      timeSeriesUsersResult,
      timeSeriesTripsResult,
    ] = await Promise.all([
      // Current period users
      supabase
        .from('users')
        .select('*', { count: 'exact' })
        .gte('created_at', startDateStr),
      
      // Previous period users
      supabase
        .from('users')
        .select('*', { count: 'exact' })
        .gte('created_at', previousStartDateStr)
        .lt('created_at', startDateStr),
      
      // Current period trips
      supabase
        .from('trips')
        .select('*', { count: 'exact' })
        .gte('created_at', startDateStr),
      
      // Previous period trips
      supabase
        .from('trips')
        .select('*', { count: 'exact' })
        .gte('created_at', previousStartDateStr)
        .lt('created_at', startDateStr),
      
      // Current period quotes
      supabase
        .from('quotes')
        .select('*', { count: 'exact' })
        .gte('created_at', startDateStr),
      
      // Previous period quotes
      supabase
        .from('quotes')
        .select('*', { count: 'exact' })
        .gte('created_at', previousStartDateStr)
        .lt('created_at', startDateStr),
      
      // Driver tokens
      supabase
        .from('driver_tokens')
        .select('*'),
      
      // Trips by status
      supabase
        .from('trips')
        .select('status')
        .gte('created_at', startDateStr),
      
      // Time series for users
      supabase
        .from('users')
        .select('created_at')
        .gte('created_at', startDateStr)
        .order('created_at', { ascending: true }),
      
      // Time series for trips
      supabase
        .from('trips')
        .select('created_at, user_email')
        .gte('created_at', startDateStr)
        .order('created_at', { ascending: true }),
    ]);

    // Get all users and trips for comprehensive metrics
    const { data: allUsers } = await supabase.from('users').select('email, created_at');
    const { data: allTrips } = await supabase.from('trips').select('user_email, locations, version, created_at');
    const { data: allQuotes } = await supabase.from('quotes').select('trip_id');

    // Calculate metrics
    const totalUsers = allUsers?.length || 0;
    const currentPeriodUsers = usersResult.count || 0;
    const previousPeriodUsers = previousUsersResult.count || 0;
    const userGrowth = previousPeriodUsers > 0 
      ? ((currentPeriodUsers - previousPeriodUsers) / previousPeriodUsers) * 100 
      : 0;

    const totalTrips = allTrips?.length || 0;
    const currentPeriodTrips = tripsResult.count || 0;
    const previousPeriodTrips = previousTripsResult.count || 0;
    const tripGrowth = previousPeriodTrips > 0
      ? ((currentPeriodTrips - previousPeriodTrips) / previousPeriodTrips) * 100
      : 0;

    const avgTripsPerUser = totalUsers > 0 ? totalTrips / totalUsers : 0;

    // Calculate reports per user over time
    const reportsPerUserTimeSeries = calculateReportsPerUserOverTime(
      (timeSeriesTripsResult.data || []).filter((t): t is { created_at: string; user_email: string } => t.created_at !== null),
      (allUsers || []).filter((u): u is { email: string; created_at: string } => u.created_at !== null),
      daysAgo
    );

    const totalQuotes = allQuotes?.length || 0;
    const currentPeriodQuotes = quotesResult.count || 0;
    const previousPeriodQuotes = previousQuotesResult.count || 0;
    const quoteGrowth = previousPeriodQuotes > 0
      ? ((currentPeriodQuotes - previousPeriodQuotes) / previousPeriodQuotes) * 100
      : 0;

    const avgQuotesPerTrip = totalTrips > 0 ? totalQuotes / totalTrips : 0;

    // Calculate average locations per trip
    const avgLocationsPerTrip = allTrips && allTrips.length > 0
      ? allTrips.reduce((sum, trip) => {
          const locations = Array.isArray(trip.locations) ? trip.locations.length : 0;
          return sum + locations;
        }, 0) / allTrips.length
      : 0;

    // Calculate trip updates per report (avg version)
    const avgUpdatesPerReport = allTrips && allTrips.length > 0
      ? allTrips.reduce((sum, trip) => sum + (trip.version || 0), 0) / allTrips.length
      : 0;

    // Driver token usage
    const driverTokens = driverTokensResult.data || [];
    const usedTokens = driverTokens.filter(t => t.used).length;
    const driverTokenUsageRate = driverTokens.length > 0
      ? (usedTokens / driverTokens.length) * 100
      : 0;

    // Trips by status
    const tripsByStatus = (tripsByStatusResult.data || []).reduce((acc: Record<string, number>, trip) => {
      const status = trip.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Time series data for charts
    const userTimeSeries = aggregateTimeSeries(
      (timeSeriesUsersResult.data || []).filter((u): u is { created_at: string } => u.created_at !== null), 
      daysAgo
    );
    const tripTimeSeries = aggregateTimeSeries(
      (timeSeriesTripsResult.data || [])
        .filter((t): t is { created_at: string; user_email: string } => t.created_at !== null)
        .map(t => ({ created_at: t.created_at })), 
      daysAgo
    );

    return NextResponse.json({
      success: true,
      data: {
        timeRange,
        metrics: {
          users: {
            total: totalUsers,
            current: currentPeriodUsers,
            growth: Math.round(userGrowth * 10) / 10,
          },
          trips: {
            total: totalTrips,
            current: currentPeriodTrips,
            growth: Math.round(tripGrowth * 10) / 10,
            avgPerUser: Math.round(avgTripsPerUser * 100) / 100,
            avgLocationsPerTrip: Math.round(avgLocationsPerTrip * 100) / 100,
            avgUpdatesPerReport: Math.round(avgUpdatesPerReport * 100) / 100,
          },
          quotes: {
            total: totalQuotes,
            current: currentPeriodQuotes,
            growth: Math.round(quoteGrowth * 10) / 10,
            avgPerTrip: Math.round(avgQuotesPerTrip * 100) / 100,
          },
          driverTokens: {
            total: driverTokens.length,
            used: usedTokens,
            usageRate: Math.round(driverTokenUsageRate * 10) / 10,
          },
        },
        charts: {
          userTimeSeries,
          tripTimeSeries,
          reportsPerUserTimeSeries,
          tripsByStatus: Object.entries(tripsByStatus).map(([status, count]) => ({
            status,
            count,
          })),
        },
      },
    });
  } catch (error) {
    console.error('Analytics error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch analytics',
      },
      { status: error instanceof Error && error.message.includes('Unauthorized') ? 403 : 500 }
    );
  }
}

// Helper function to aggregate time series data
function aggregateTimeSeries(data: Array<{ created_at: string }>, daysAgo: number) {
  const now = new Date();
  const result: Array<{ date: string; count: number }> = [];

  // Create buckets for each day
  for (let i = daysAgo - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    result.push({ date: dateStr, count: 0 });
  }

  // Count items per day
  data.forEach(item => {
    const dateStr = item.created_at.split('T')[0];
    const bucket = result.find(r => r.date === dateStr);
    if (bucket) {
      bucket.count++;
    }
  });

  return result;
}

// Helper function to calculate reports per user over time
function calculateReportsPerUserOverTime(
  trips: Array<{ created_at: string; user_email: string }>,
  users: Array<{ email: string; created_at: string }>,
  daysAgo: number
) {
  const now = new Date();
  const result: Array<{ date: string; reportsPerUser: number }> = [];

  // Create buckets for each day
  for (let i = daysAgo - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // Count trips up to this date
    const tripsUpToDate = trips.filter(t => t.created_at.split('T')[0] <= dateStr);
    
    // Count users up to this date
    const usersUpToDate = users.filter(u => u.created_at.split('T')[0] <= dateStr);
    
    const reportsPerUser = usersUpToDate.length > 0 
      ? tripsUpToDate.length / usersUpToDate.length 
      : 0;
    
    result.push({ 
      date: dateStr, 
      reportsPerUser: Math.round(reportsPerUser * 100) / 100 
    });
  }

  return result;
}

