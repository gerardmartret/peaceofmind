import openai from './openai';

export interface QualityEvaluationInput {
  tripId: string;
  locations: Array<{
    location: string;
    purpose?: string;
    lat: number;
    lng: number;
    time: string;
  }>;
  tripDate: string;
  passengerCount?: number | null;
  tripNotes?: string | null;
  tripDestination?: string | null;
  executiveReport: any;
  tripResults: any;
}

export interface QualityScore {
  overallScore: number;
  scores: {
    critical_identification: {
      score: number;
      reasoning: string;
      examples: string[];
    };
    exceptional_circumstances: {
      score: number;
      reasoning: string;
      examples: string[];
    };
    actionability: {
      score: number;
      reasoning: string;
      examples: string[];
    };
    communication_clarity: {
      score: number;
      reasoning: string;
      examples: string[];
    };
  };
  strengths: string[];
  weaknesses: string[];
  missedOpportunities: string[];
}

export async function evaluateReportQuality(
  input: QualityEvaluationInput
): Promise<QualityScore> {
  try {
    console.log(`🔍 Starting quality evaluation for trip ${input.tripId}`);

    // Extract only the essential parts of the report for evaluation
    const executiveSummary = {
      overallSummary: input.executiveReport?.overallSummary || '',
      exceptionalInformation: input.executiveReport?.exceptionalInformation || '',
      importantInformation: input.executiveReport?.importantInformation || '',
      highlights: input.executiveReport?.highlights || [],
      recommendations: input.executiveReport?.recommendations || [],
      tripRiskScore: input.executiveReport?.tripRiskScore || 0,
      topDisruptor: input.executiveReport?.topDisruptor || ''
    };

    const evaluationPrompt = `You are evaluating the quality of an AI-generated trip analysis report.

TRIP INPUT:
${JSON.stringify({
  locations: input.locations.map(l => ({
    name: l.location,
    purpose: l.purpose || 'Not specified',
    coordinates: [l.lat, l.lng],
    time: l.time
  })),
  date: input.tripDate,
  passengerCount: input.passengerCount || 'Not specified',
  notes: input.tripNotes || 'None',
  destination: input.tripDestination || 'Not specified'
}, null, 2)}

GENERATED REPORT (Key Sections):
${JSON.stringify(executiveSummary, null, 2)}

Evaluate this report on 4 criteria (each 0-25 points):

1. CRITICAL INFORMATION IDENTIFICATION (0-25 points)
   - Did the AI identify what's most important for THIS specific trip?
   - Are critical time constraints highlighted appropriately?
   - Are purpose-specific needs properly addressed?
   - Is route complexity/difficulty assessed correctly?
   
2. EXCEPTIONAL CIRCUMSTANCES (0-25 points)
   - Did the AI catch any unusual or exceptional factors?
   - Are potential issues/risks flagged proactively?
   - Are opportunities highlighted (e.g., favorable conditions)?
   - Is context awareness demonstrated?

3. ACTIONABILITY (0-25 points)
   - Can the driver clearly understand what to do?
   - Are recommendations specific and practical?
   - Is timing/routing guidance clear and useful?
   - Are contingency plans provided where needed?

4. COMMUNICATION CLARITY (0-25 points)
   - Is important information easy to find?
   - Is the language clear and professional?
   - Is the report well-structured and organized?
   - Is the level of detail appropriate (not too much/little)?

For each criterion, provide:
- A score between 0-25
- Reasoning explaining the score
- 2-3 specific examples from the report

Also identify:
- 2-3 key strengths of the report
- 2-3 weaknesses or areas for improvement
- 1-2 missed opportunities (what could have been better)

IMPORTANT: Be constructive but honest. A perfect score (100) should be rare and reserved for exceptional reports.

Return ONLY valid JSON in this exact format:
{
  "scores": {
    "critical_identification": {
      "score": 22,
      "reasoning": "The report correctly identified...",
      "examples": ["Example 1", "Example 2"]
    },
    "exceptional_circumstances": {
      "score": 18,
      "reasoning": "The AI caught...",
      "examples": ["Example 1", "Example 2"]
    },
    "actionability": {
      "score": 24,
      "reasoning": "Clear guidance was provided...",
      "examples": ["Example 1", "Example 2"]
    },
    "communication_clarity": {
      "score": 20,
      "reasoning": "The report structure...",
      "examples": ["Example 1", "Example 2"]
    }
  },
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "weaknesses": ["Weakness 1", "Weakness 2"],
  "missedOpportunities": ["Opportunity 1", "Opportunity 2"]
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert quality evaluator for trip planning and driver briefing reports. You assess reports objectively and provide constructive feedback.'
        },
        {
          role: 'user',
          content: evaluationPrompt
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent evaluations
      response_format: { type: 'json_object' }
    });

    const evaluationResult = response.choices[0].message.content;
    
    if (!evaluationResult) {
      throw new Error('No evaluation result received from OpenAI');
    }

    const parsed = JSON.parse(evaluationResult);
    
    // Calculate overall score
    const overallScore = Math.round(
      parsed.scores.critical_identification.score +
      parsed.scores.exceptional_circumstances.score +
      parsed.scores.actionability.score +
      parsed.scores.communication_clarity.score
    );

    console.log(`✅ Quality evaluation complete for trip ${input.tripId}: ${overallScore}/100`);

    return {
      overallScore,
      scores: parsed.scores,
      strengths: parsed.strengths || [],
      weaknesses: parsed.weaknesses || [],
      missedOpportunities: parsed.missedOpportunities || []
    };
  } catch (error) {
    console.error(`❌ Error evaluating trip ${input.tripId}:`, error);
    throw error;
  }
}

