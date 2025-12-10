/**
 * Report Service
 * 
 * Centralized service for generating executive reports.
 * Provides consistent error handling and API interaction.
 */

import { transformResultsForReport, calculateRouteDistance, calculateRouteDuration } from '../utils/report-transformers';
import type { TripResult } from '../utils/report-transformers';

export interface GenerateReportParams {
  results: TripResult[];
  tripDate: string;
  trafficData?: any;
  emailContent?: string | null;
  leadPassengerName?: string | null;
  vehicleInfo?: string | null;
  passengerCount?: number;
  tripDestination?: string | null;
  passengerNames?: string[];
  driverNotes?: string | null;
}

export interface GenerateReportResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Generates an executive report by calling the report API.
 * 
 * @param params - Report generation parameters
 * @returns Report data or null if generation failed
 * @throws Error only if the request itself fails (network error, etc.)
 *         API errors are logged but don't throw to avoid breaking trip flow
 */
export async function generateReport(
  params: GenerateReportParams
): Promise<GenerateReportResult> {
  try {
    // Transform results to consistent format
    const reportData = transformResultsForReport(params.results);

    // Calculate route metrics
    const routeDistance = calculateRouteDistance(params.trafficData);
    const routeDuration = calculateRouteDuration(params.trafficData);

    // Extract traffic predictions (if available)
    const trafficPredictions = params.trafficData?.success
      ? params.trafficData.data
      : params.trafficData?.data || null;

    // Call report API
    const reportResponse = await fetch('/api/executive-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tripData: reportData,
        tripDate: params.tripDate,
        routeDistance,
        routeDuration,
        trafficPredictions,
        emailContent: params.emailContent || null,
        leadPassengerName: params.leadPassengerName || null,
        vehicleInfo: params.vehicleInfo || null,
        passengerCount: params.passengerCount || 1,
        tripDestination: params.tripDestination || null,
        passengerNames: params.passengerNames || [],
        driverNotes: params.driverNotes || null,
      }),
    });

    const reportResult = await reportResponse.json();

    if (reportResult.success) {
      console.log('✅ Executive Report Generated!');
      console.log(`🎯 Trip Risk Score: ${reportResult.data.tripRiskScore}/10`);
      return {
        success: true,
        data: reportResult.data,
      };
    } else {
      console.error('❌ Executive Report API returned error:', reportResult.error);
      console.error('Full response:', reportResult);
      return {
        success: false,
        error: reportResult.error || 'Failed to generate report',
      };
    }
  } catch (error) {
    // Log error but don't throw - report generation failure shouldn't break trip flow
    console.error('⚠️ Could not generate executive report:', error);
    console.error(
      'Error details:',
      error instanceof Error ? error.message : String(error)
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

