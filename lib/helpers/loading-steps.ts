import { getCityConfig } from '@/lib/city-helpers';

export interface LoadingStep {
  id: string;
  title: string;
  description: string;
  source: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  locationIndex?: number;
}

/**
 * Professional loading steps generator (city-aware)
 * Generates loading steps based on trip destination and locations
 * @param locations - Array of trip locations
 * @param tripDestination - Optional trip destination city
 * @returns Array of loading steps with appropriate status
 */
export const generateLoadingSteps = (locations: any[], tripDestination?: string): LoadingStep[] => {
  const cityConfig = getCityConfig(tripDestination);
  const steps: LoadingStep[] = [];
  let stepId = 1;

  // London-specific data sources
  if (cityConfig.isLondon) {
    steps.push({
      id: `step-${stepId++}`,
      title: `Analyzing crime & safety data`,
      description: `Retrieving safety statistics and crime reports from official UK Police database`,
      source: 'UK Police National Database',
      status: 'pending' as const
    });

    steps.push({
      id: `step-${stepId++}`,
      title: `Assessing traffic conditions`,
      description: `Pulling real-time traffic data, road closures, and congestion patterns`,
      source: 'Transport for London',
      status: 'pending' as const
    });

    steps.push({
      id: `step-${stepId++}`,
      title: `Checking public transport disruptions`,
      description: `Monitoring Underground, bus, and rail service disruptions`,
      source: 'TfL Unified API',
      status: 'pending' as const
    });
  }

  // Universal data sources (all cities)
  steps.push({
    id: `step-${stepId++}`,
    title: `Analyzing weather conditions`,
    description: `Gathering meteorological data and forecast models for trip planning`,
    source: 'Open-Meteo Weather Service',
    status: 'pending' as const
  });

  // DISABLED: Event search to reduce OpenAI costs
  // steps.push({
  //   id: `step-${stepId++}`,
  //   title: `Scanning major events`,
  //   description: `Identifying concerts, sports events, and gatherings affecting traffic`,
  //   source: 'Event Intelligence Network',
  //   status: 'pending' as const
  // });

  // London-specific parking
  if (cityConfig.isLondon) {
    steps.push({
      id: `step-${stepId++}`,
      title: `Evaluating parking availability`,
      description: `Analyzing parking facilities, restrictions, and pricing information`,
      source: 'TfL Parking Database',
      status: 'pending' as const
    });
  }

  // Universal: Route calculation
  steps.push({
    id: `step-${stepId++}`,
    title: `Calculating optimal routes`,
    description: `Processing route efficiency, travel times, and traffic predictions`,
    source: 'Google Maps Directions API',
    status: 'pending' as const
  });

  // Universal: AI analysis
  steps.push({
    id: `step-${stepId++}`,
    title: `Generating risk assessment`,
    description: `Synthesizing data into comprehensive executive report with recommendations`,
    source: 'OpenAI GPT-4 Analysis',
    status: 'pending' as const
  });

  return steps;
};

