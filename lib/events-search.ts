import openai from './openai';

export interface Event {
  title: string;
  description: string;
  date?: string;
  severity: 'high' | 'medium' | 'low';
  type: 'strike' | 'protest' | 'festival' | 'construction' | 'other';
}

/**
 * Search for upcoming events that might affect a VIP trip
 * Uses web search + OpenAI to find and filter relevant events
 */
export async function searchLocationEvents(
  locationName: string,
  lat: number,
  lng: number,
  date: string
): Promise<Event[]> {
  try {
    console.log(`\n🔍 Searching events for: ${locationName}`);
    console.log(`📅 Date: ${date}`);
    console.log(`📍 Coordinates: ${lat}, ${lng}`);
    console.log(`🤖 Using model: gpt-4o-search-preview with web search`);

    // Create a search query for events
    const areaName = locationName.split(',')[0];
    const searchQuery = `${areaName} London strikes protests festivals road closures events ${date}`;

    // Use OpenAI GPT-4o Search Preview with web search capability (optimized)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-search-preview',
      // @ts-ignore - web_search_options is a valid parameter for search-enabled models
      web_search_options: {},
      messages: [
        {
          role: 'user',
          content: `Search web for traffic disruptive events near ${locationName} on ${date}.

Find: strikes, protests, festivals, road closures, construction, sports events, public gatherings.

Location: ${locationName} (${lat}, ${lng})
Date: ${date}

Return JSON only: {"events":[{"name":"str","description":"str","date":"str","location":"str"}]}
Max 3 events.`
        }
      ],
      max_tokens: 500
    });

    const responseText = completion.choices[0]?.message?.content || '';
    
    console.log(`\n🔧 Model used: ${completion.model}`);
    console.log(`📊 Tokens: ${completion.usage?.total_tokens}`);
    console.log(`💰 Estimated cost: $${((completion.usage?.prompt_tokens || 0) * 2.50 / 1000000 + (completion.usage?.completion_tokens || 0) * 10.00 / 1000000).toFixed(6)}`);
    console.log(`\n📝 GPT-4o-search Response (first 300 chars):`);
    console.log(responseText.substring(0, 300) + '...');
    
    try {
      // Extract JSON from response (GPT often wraps it in markdown code blocks)
      let jsonText = responseText;
      
      // Remove markdown code blocks if present
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // Try to find JSON object with events array
      let jsonMatch = jsonText.match(/\{[\s\S]*?"events"[\s\S]*?\]/);
      
      if (jsonMatch) {
        // Ensure it's properly closed
        let bracketCount = 0;
        let endIndex = 0;
        for (let i = jsonMatch.index!; i < jsonText.length; i++) {
          if (jsonText[i] === '{') bracketCount++;
          if (jsonText[i] === '}') {
            bracketCount--;
            if (bracketCount === 0) {
              endIndex = i + 1;
              break;
            }
          }
        }
        if (endIndex > 0) {
          jsonMatch[0] = jsonText.substring(jsonMatch.index!, endIndex);
        }
      }
      
      if (!jsonMatch) {
        console.log('⚠️  No JSON found in response, returning empty events');
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      let rawEvents = parsed.events || [];
      
      // Transform to our Event format
      const events: Event[] = rawEvents.map((e: any) => {
        const title = e.name || e.title || 'Unnamed Event';
        const description = e.description || e.details || '';
        const eventType = determineEventType(title, description);
        const severity = e.severity || determineSeverity(title, description, eventType);
        
        return {
          title,
          description,
          date: e.date || undefined,
          severity: severity as 'high' | 'medium' | 'low',
          type: eventType
        };
      });
      
      console.log(`✅ Found ${events.length} relevant event(s)`);
      
      if (events.length > 0) {
        console.log('\n📋 Events returned:');
        events.forEach((e: Event, i: number) => {
          console.log(`  ${i + 1}. ${e.title} (${e.type}, ${e.severity})`);
        });
      }
      
      return events.slice(0, 5); // Max 5 events
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      console.error('Raw response (first 500 chars):', responseText.substring(0, 500));
      return [];
    }
  } catch (error) {
    console.error('Error searching events:', error);
    return [];
  }
}

/**
 * Determine event type from title and description
 */
function determineEventType(title: string, description: string): Event['type'] {
  const text = (title + ' ' + description).toLowerCase();
  
  if (text.includes('strike') || text.includes('walkout')) return 'strike';
  if (text.includes('protest') || text.includes('demonstration') || text.includes('march')) return 'protest';
  if (text.includes('festival') || text.includes('celebration') || text.includes('parade') || text.includes('firework')) return 'festival';
  if (text.includes('construction') || text.includes('closure') || text.includes('roadwork')) return 'construction';
  
  return 'other';
}

/**
 * Determine severity based on event type and content
 */
function determineSeverity(title: string, description: string, type: Event['type']): 'high' | 'medium' | 'low' {
  const text = (title + ' ' + description).toLowerCase();
  
  // High severity indicators
  if (type === 'strike' && (text.includes('transport') || text.includes('underground') || text.includes('tube'))) return 'high';
  if (type === 'protest' && (text.includes('major') || text.includes('large'))) return 'high';
  if (text.includes('road closure') || text.includes('major disruption')) return 'high';
  
  // Low severity for library events, small gatherings
  if (text.includes('library') || text.includes('small')) return 'low';
  
  // Medium for festivals and other events
  if (type === 'festival') return 'medium';
  
  return 'medium';
}

/**
 * Get a summary of all events for display
 */
export function getEventsSummary(events: Event[]) {
  return {
    total: events.length,
    byType: events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    bySeverity: events.reduce((acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    highSeverity: events.filter(e => e.severity === 'high').length,
  };
}

