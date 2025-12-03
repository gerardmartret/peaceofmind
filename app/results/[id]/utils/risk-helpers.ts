// Calculate combined schedule risk (timeline realism + traffic delay)
export const calculateCombinedScheduleRisk = (
  trafficDelay: number,
  timelineRealism: 'realistic' | 'tight' | 'unrealistic' | null,
  userExpectedMinutes: number,
  googleCalculatedMinutes: number
): {
  level: 'low' | 'moderate' | 'high';
  label: string;
  color: string;
  reason: string;
} => {
  // If timeline is unrealistic, always high risk regardless of traffic
  if (timelineRealism === 'unrealistic') {
    return {
      level: 'high',
      label: 'Schedule risk: High',
      color: '#9e201b',
      reason: `Timeline unrealistic - travel time is ${googleCalculatedMinutes} min but you allocated ${userExpectedMinutes} min`,
    };
  }

  // If timeline is tight, elevate risk
  if (timelineRealism === 'tight') {
    if (trafficDelay >= 10) {
      return {
        level: 'high',
        label: 'Schedule risk: High',
        color: '#9e201b',
        reason: 'Tight timeline + high traffic delay',
      };
    } else if (trafficDelay >= 5) {
      return {
        level: 'moderate',
        label: 'Schedule risk: Moderate',
        color: '#db7304',
        reason: 'Tight timeline + moderate traffic delay',
      };
    } else {
      return {
        level: 'moderate',
        label: 'Schedule risk: Moderate',
        color: '#db7304',
        reason: 'Tight timeline - consider adding buffer time',
      };
    }
  }

  // If timeline is realistic, use traffic delay thresholds as-is
  if (trafficDelay < 5) {
    return {
      level: 'low',
      label: 'Delay risk: Low',
      color: '#3ea34b',
      reason: 'Low traffic delay',
    };
  } else if (trafficDelay < 10) {
    return {
      level: 'moderate',
      label: 'Delay risk: Moderate',
      color: '#db7304',
      reason: 'Moderate traffic delay',
    };
  } else {
    return {
      level: 'high',
      label: 'Delay risk: High',
      color: '#9e201b',
      reason: 'High traffic delay',
    };
  }
};

// Calculate timeline realism by comparing user input times with Google Maps calculated travel times
export const calculateTimelineRealism = (
  locations: Array<{ time: string }>,
  trafficPredictions: any,
  tripDate: string
): Array<{
  legIndex: number;
  userExpectedMinutes: number;
  googleCalculatedMinutes: number;
  differenceMinutes: number;
  realismLevel: 'realistic' | 'tight' | 'unrealistic';
  message: string;
}> => {
  const results: Array<{
    legIndex: number;
    userExpectedMinutes: number;
    googleCalculatedMinutes: number;
    differenceMinutes: number;
    realismLevel: 'realistic' | 'tight' | 'unrealistic';
    message: string;
  }> = [];

  if (!trafficPredictions?.success || !trafficPredictions.data || locations.length < 2) {
    return results;
  }

  for (let i = 0; i < locations.length - 1; i++) {
    const origin = locations[i];
    const destination = locations[i + 1];
    const trafficLeg = trafficPredictions.data[i];

    if (!origin.time || !destination.time || !trafficLeg) {
      continue;
    }

    // Parse user input times
    const originTimeParts = origin.time.split(':');
    const destTimeParts = destination.time.split(':');
    const originHours = parseInt(originTimeParts[0]) || 0;
    const originMinutes = parseInt(originTimeParts[1]) || 0;
    const destHours = parseInt(destTimeParts[0]) || 0;
    const destMinutes = parseInt(destTimeParts[1]) || 0;

    // Create date objects for the trip date with the times
    const tripDateObj = new Date(tripDate);
    const originDateTime = new Date(tripDateObj);
    originDateTime.setHours(originHours, originMinutes, 0, 0);

    const destDateTime = new Date(tripDateObj);
    destDateTime.setHours(destHours, destMinutes, 0, 0);

    // Handle next-day transitions (e.g., 23:00 -> 01:00)
    if (destDateTime <= originDateTime) {
      destDateTime.setDate(destDateTime.getDate() + 1);
    }

    // Calculate user expected time in minutes
    const userExpectedMs = destDateTime.getTime() - originDateTime.getTime();
    const userExpectedMinutes = Math.round(userExpectedMs / (1000 * 60));

    // Get Google calculated travel time
    const googleCalculatedMinutes = trafficLeg.minutes || 0;

    // Calculate difference (positive = user has more time, negative = user has less time)
    const differenceMinutes = userExpectedMinutes - googleCalculatedMinutes;

    // Determine realism level
    // Realistic: User time >= Google time (or within 10% buffer)
    // Tight: User time is 10-30% less than Google time
    // Unrealistic: User time is >30% less than Google time
    let realismLevel: 'realistic' | 'tight' | 'unrealistic';
    let message: string;

    if (differenceMinutes >= -googleCalculatedMinutes * 0.1) {
      // User has at least 90% of the required time (realistic)
      realismLevel = 'realistic';
      message = 'Your timeline looks good';
    } else if (differenceMinutes >= -googleCalculatedMinutes * 0.3) {
      // User has 70-90% of the required time (tight)
      realismLevel = 'tight';
      message = 'Your timeline is tight - consider adding buffer time';
    } else {
      // User has less than 70% of the required time (unrealistic)
      realismLevel = 'unrealistic';
      message = 'Your timeline may be unrealistic - travel time is longer than expected';
    }

    results.push({
      legIndex: i,
      userExpectedMinutes,
      googleCalculatedMinutes,
      differenceMinutes,
      realismLevel,
      message,
    });
  }

  return results;
};

