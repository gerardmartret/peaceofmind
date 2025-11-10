import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json({ 
        error: 'No audio file provided',
        success: false 
      }, { status: 400 });
    }

    // Check file size (25MB limit for Whisper)
    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json({ 
        error: 'Audio file too large. Maximum size is 25MB.',
        success: false 
      }, { status: 400 });
    }

    console.log('🎵 [TRANSCRIBE] Processing audio file:', audioFile.name, `(${(audioFile.size / 1024).toFixed(2)}KB)`);

    // Transcribe with Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "en", // Can be removed for auto-detection
    });

    console.log('✅ [TRANSCRIBE] Success:', transcription.text.substring(0, 100) + '...');

    return NextResponse.json({ 
      text: transcription.text,
      success: true 
    });
  } catch (error: any) {
    console.error('❌ [TRANSCRIBE] Error:', error);
    
    return NextResponse.json({ 
      error: error.message || 'Failed to transcribe audio',
      success: false 
    }, { status: 500 });
  }
}

