import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { evaluateReportQuality } from '@/lib/quality-evaluator';

export async function POST(request: Request) {
  let tripId: string | undefined;
  
  try {
    const body = await request.json();
    tripId = body.tripId;

    if (!tripId) {
      return NextResponse.json(
        { success: false, error: 'Trip ID is required' },
        { status: 400 }
      );
    }

    console.log(`📊 Starting quality evaluation for trip: ${tripId}`);

    // Fetch the trip data
    const { data: trip, error: fetchError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .single();

    if (fetchError || !trip) {
      console.error(`❌ Error fetching trip ${tripId}:`, fetchError);
      return NextResponse.json(
        { success: false, error: 'Trip not found' },
        { status: 404 }
      );
    }

    // Check if already evaluated (skip if recent)
    if (trip.quality_evaluated_at) {
      const evaluatedAt = new Date(trip.quality_evaluated_at);
      const now = new Date();
      const hoursSinceEval = (now.getTime() - evaluatedAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceEval < 24) {
        console.log(`⏭️  Trip ${tripId} was recently evaluated, skipping`);
        return NextResponse.json({
          success: true,
          message: 'Trip was recently evaluated',
          score: trip.generation_quality_score
        });
      }
    }

    // Prepare input for evaluation
    const locations = Array.isArray(trip.locations) ? trip.locations : [];
    
    const evaluationInput = {
      tripId: trip.id,
      locations: locations.map((loc: any) => ({
        location: loc.location || loc.name || 'Unknown',
        purpose: loc.purpose,
        lat: loc.lat,
        lng: loc.lng,
        time: loc.time
      })),
      tripDate: trip.trip_date,
      passengerCount: trip.passenger_count,
      tripNotes: trip.trip_notes,
      tripDestination: trip.trip_destination,
      executiveReport: trip.executive_report,
      tripResults: trip.trip_results
    };

    // Evaluate the report quality
    const qualityResult = await evaluateReportQuality(evaluationInput);

    // Update the trip with quality scores
    const { error: updateError } = await supabase
      .from('trips')
      .update({
        generation_quality_score: qualityResult.overallScore,
        generation_quality_breakdown: qualityResult.scores,
        quality_strengths: qualityResult.strengths,
        quality_weaknesses: qualityResult.weaknesses,
        quality_missed_opportunities: qualityResult.missedOpportunities,
        quality_evaluated_at: new Date().toISOString(),
        quality_evaluation_error: null
      })
      .eq('id', tripId);

    if (updateError) {
      console.error(`❌ Error updating trip ${tripId} with quality scores:`, updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to update quality scores' },
        { status: 500 }
      );
    }

    console.log(`✅ Quality evaluation completed for trip ${tripId}: ${qualityResult.overallScore}/100`);

    return NextResponse.json({
      success: true,
      data: {
        tripId,
        qualityScore: qualityResult.overallScore,
        breakdown: qualityResult.scores,
        strengths: qualityResult.strengths,
        weaknesses: qualityResult.weaknesses,
        missedOpportunities: qualityResult.missedOpportunities
      }
    });
  } catch (error) {
    console.error('❌ Error in quality evaluation:', error);

    // Try to store the error in the database
    if (tripId) {
      try {
        await supabase
          .from('trips')
          .update({
            quality_evaluation_error: error instanceof Error ? error.message : 'Unknown error',
            quality_evaluated_at: new Date().toISOString()
          })
          .eq('id', tripId);
      } catch (storeError) {
        console.error('Failed to store error:', storeError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Quality evaluation failed'
      },
      { status: 500 }
    );
  }
}

