import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import openai from '@/lib/openai';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase configuration for trip search');
}

type SearchCriteria = {
  passengerName?: string | null;
  tripDate?: string | null;
  location?: string | null;
};

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

function extractJsonPayload(content: string): string {
  const match = content.trim().match(/\{[\s\S]*\}/);
  return match ? match[0] : content;
}

function normalizeString(value?: string | null): string {
  return value?.toLowerCase().trim() || '';
}

function parseTripLocations(raw: unknown): Array<{ name?: string }> {
  if (Array.isArray(raw)) {
    return raw;
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      console.warn('Unable to parse saved trip locations JSON');
    }
  }

  return [];
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.query !== 'string' || !body.query.trim()) {
      return NextResponse.json({ error: 'Describe what you are looking for.' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 });
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return NextResponse.json({ error: 'Invalid authorization token' }, { status: 401 });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Unable to authenticate user', detail: userError?.message }, { status: 401 });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 150,
      messages: [
        {
          role: 'system',
          content: `You are a JSON extraction assistant focused on chauffeured trips. The user will describe a trip via passenger name, date, or stop information. Respond with a JSON object with the following keys (all optional): "passengerName", "tripDate", "location". Always output valid JSON only; do not add explanations. Dates should be formatted as YYYY-MM-DD when available.Remember to return null or omit keys that cannot be determined.`,
        },
        {
          role: 'user',
          content: `User text: """${body.query.trim()}"""`,
        },
      ],
    });

    const rawContent = completion.choices?.[0]?.message?.content ?? '';
    const jsonPayload = extractJsonPayload(rawContent);
    let parsedCriteria: SearchCriteria = {};

    try {
      const parsed = JSON.parse(jsonPayload);
      parsedCriteria = {
        passengerName: typeof parsed.passengerName === 'string' ? parsed.passengerName.trim() : null,
        tripDate: typeof parsed.tripDate === 'string' ? parsed.tripDate.trim() : null,
        location: typeof parsed.location === 'string' ? parsed.location.trim() : null,
      };
    } catch (error) {
      console.error('❌ Unable to parse extraction JSON:', error);
      return NextResponse.json({ error: 'Unable to understand the search description' }, { status: 400 });
    }

    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('id, trip_date, created_at, locations, passenger_count, trip_destination, lead_passenger_name, vehicle, trip_notes')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);

    if (tripsError) {
      console.error('❌ Supabase trip search error:', tripsError);
      return NextResponse.json({ error: 'Unable to fetch trips' }, { status: 500 });
    }

    const normalizedPassenger = normalizeString(parsedCriteria.passengerName);
    const normalizedLocation = normalizeString(parsedCriteria.location);
    const normalizedTripDate = parsedCriteria.tripDate ? new Date(parsedCriteria.tripDate) : null;
    const dateFilter = normalizedTripDate && !Number.isNaN(normalizedTripDate.getTime())
      ? normalizedTripDate.toISOString().split('T')[0]
      : null;

    const matches = (trips || []).filter((trip) => {
      let matched = true;

      if (normalizedPassenger) {
        const candidate = normalizeString(trip.lead_passenger_name || trip.trip_notes);
        matched = matched && candidate.includes(normalizedPassenger);
      }

      if (dateFilter) {
        const tripDateValue = trip.trip_date ? new Date(trip.trip_date) : null;
        const tripDateString = tripDateValue && !Number.isNaN(tripDateValue.getTime())
          ? tripDateValue.toISOString().split('T')[0]
          : '';
        matched = matched && tripDateString === dateFilter;
      }

      if (normalizedLocation) {
        const locationCandidate = normalizeString(trip.trip_destination)
          + ' '
          + normalizeString(trip.trip_notes);

        const parsedLocations = parseTripLocations(trip.locations);
        const locationsString = parsedLocations
          .map((loc) => {
            if (loc && typeof loc === 'object') {
              return normalizeString((loc as any).name);
            }
            return normalizeString(String(loc));
          })
          .filter(Boolean)
          .join(' ');

        matched = matched && (locationCandidate.includes(normalizedLocation) || locationsString.includes(normalizedLocation));
      }

      return matched;
    }).slice(0, 25);

    return NextResponse.json({
      matches: matches.map((trip) => ({
        id: trip.id,
        trip_date: trip.trip_date,
        created_at: trip.created_at,
        locations: trip.locations,
        passenger_count: trip.passenger_count,
        trip_destination: trip.trip_destination,
        lead_passenger_name: trip.lead_passenger_name,
        vehicle: trip.vehicle,
        trip_notes: trip.trip_notes,
      })),
      criteria: {
        passengerName: parsedCriteria.passengerName || null,
        tripDate: parsedCriteria.tripDate || null,
        location: parsedCriteria.location || null,
      },
    });
  } catch (error) {
    console.error('❌ Error in trip search API:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unable to execute search',
    }, { status: 500 });
  }
}

