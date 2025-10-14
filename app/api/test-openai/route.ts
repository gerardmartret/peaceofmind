import { NextResponse } from 'next/server';
import { testOpenAIConnection } from '@/lib/openai';

export async function GET() {
  console.log('\n' + '='.repeat(60));
  console.log('🤖 Testing OpenAI API Connection...');
  console.log('='.repeat(60));

  try {
    const result = await testOpenAIConnection();

    if (result.success) {
      console.log('\n✅ OpenAI API Connection Successful!');
      console.log('='.repeat(60));
      console.log(`📝 Response: ${result.message}`);
      console.log(`🤖 Model: ${result.model}`);
      if (result.usage) {
        console.log(`📊 Tokens Used: ${result.usage.total_tokens} (prompt: ${result.usage.prompt_tokens}, completion: ${result.usage.completion_tokens})`);
      }
      console.log('='.repeat(60) + '\n');

      return NextResponse.json({
        success: true,
        message: 'OpenAI API connected successfully!',
        response: result.message,
        model: result.model,
        usage: result.usage,
      });
    } else {
      console.error('\n❌ OpenAI API Connection Failed!');
      console.error('='.repeat(60));
      console.error(`Error: ${result.error}`);
      console.error('='.repeat(60) + '\n');

      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 500 });
    }
  } catch (error) {
    console.error('\n❌ Unexpected Error:', error);
    console.error('='.repeat(60) + '\n');

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

