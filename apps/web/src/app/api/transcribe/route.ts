import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB Whisper API limit

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  return new OpenAI({ apiKey });
}

export async function POST(request: Request) {
  try {
    const openai = getOpenAIClient();
    const formData = await request.formData();
    const audioFile = formData.get('audio');

    if (!audioFile || !(audioFile instanceof File)) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    if (audioFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum 25MB for transcription.' },
        { status: 400 }
      );
    }

    const response = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    });

    const words = (response.words ?? []).map((w) => ({
      text: w.word,
      start: w.start,
      end: w.end,
    }));

    return NextResponse.json({
      words,
      duration: response.duration ?? 0,
      text: response.text ?? '',
    });
  } catch (error) {
    console.error('Transcription error:', error);
    const message =
      error instanceof Error ? error.message : 'Transcription failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
