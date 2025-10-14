import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default openai;

/**
 * Test OpenAI connection
 */
export async function testOpenAIConnection() {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: "Say 'Hello from OpenAI!' if you're working correctly."
        }
      ],
      max_tokens: 50,
    });

    return {
      success: true,
      message: completion.choices[0]?.message?.content || 'No response',
      model: completion.model,
      usage: completion.usage,
    };
  } catch (error) {
    console.error('OpenAI connection error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

