/**
 * Supabase Edge Function: Speech-to-Text
 *
 * Fetches audio from a Supabase Storage URL and sends it to OpenAI Whisper API
 * for transcription. Supports language hints from writer preferences.
 *
 * POST /speech-to-text
 * Body: { audio_url: string, language_preferences?: string[] }
 * Returns: { transcript: string }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

// Map common language names to ISO 639-1 codes for Whisper
const LANGUAGE_MAP: Record<string, string> = {
  hindi: 'hi',
  english: 'en',
  telugu: 'te',
  tamil: 'ta',
  bengali: 'bn',
  punjabi: 'pa',
  urdu: 'ur',
  marathi: 'mr',
  gujarati: 'gu',
  kannada: 'kn',
  malayalam: 'ml',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers':
          'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { audio_url, language_preferences } = await req.json();

    if (!audio_url || typeof audio_url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing required field: audio_url' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Fetch the audio file from storage
    const audioResponse = await fetch(audio_url);
    if (!audioResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch audio file' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const audioBlob = await audioResponse.blob();

    // Build form data for Whisper API
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.m4a');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'text');

    // Add language hint if available
    if (language_preferences?.length) {
      const primaryLang = language_preferences[0].toLowerCase();
      const langCode = LANGUAGE_MAP[primaryLang] || primaryLang;
      if (langCode.length === 2) {
        formData.append('language', langCode);
      }
    }

    // Prompt Whisper with context for better multilingual transcription
    formData.append(
      'prompt',
      'This is a family story or memory being recorded by an elder for their grandchildren. It may contain multiple languages mixed together.',
    );

    const whisperResponse = await fetch(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData,
      },
    );

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      console.error('Whisper API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Transcription failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const transcript = await whisperResponse.text();

    return new Response(
      JSON.stringify({ transcript: transcript.trim() }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Speech-to-text error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to transcribe audio' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
