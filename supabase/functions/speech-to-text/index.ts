/**
 * Supabase Edge Function: Speech-to-Text
 *
 * Primary: Sarvam AI (saaras:v3) — optimized for Indian languages + code-switching.
 * Fallback: OpenAI Whisper — for non-Indian languages or if Sarvam fails (e.g. audio > 30s).
 *
 * POST /speech-to-text
 * Body: { audio_url: string, language_preferences?: string[] }
 * Returns: { transcript: string, provider: 'sarvam' | 'whisper' }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SARVAM_API_KEY = Deno.env.get('SARVAM_API_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

// Indian languages supported by Sarvam — map to BCP-47 codes
const SARVAM_LANGUAGES: Record<string, string> = {
  hindi: 'hi-IN',
  bengali: 'bn-IN',
  kannada: 'kn-IN',
  malayalam: 'ml-IN',
  marathi: 'mr-IN',
  odia: 'od-IN',
  punjabi: 'pa-IN',
  tamil: 'ta-IN',
  telugu: 'te-IN',
  english: 'en-IN',
  gujarati: 'gu-IN',
  assamese: 'as-IN',
  urdu: 'ur-IN',
  nepali: 'ne-IN',
  konkani: 'kok-IN',
  kashmiri: 'ks-IN',
  sindhi: 'sd-IN',
  sanskrit: 'sa-IN',
  santali: 'sat-IN',
  manipuri: 'mni-IN',
  bodo: 'brx-IN',
  maithili: 'mai-IN',
  dogri: 'doi-IN',
};

// Languages where Whisper is the better choice (non-Indian)
const WHISPER_ONLY_LANGUAGES = new Set([
  'french', 'spanish', 'german', 'italian', 'portuguese', 'russian',
  'japanese', 'korean', 'chinese', 'mandarin', 'arabic', 'turkish',
  'dutch', 'swedish', 'polish', 'thai', 'vietnamese', 'indonesian',
]);

// Whisper language codes
const WHISPER_LANG_MAP: Record<string, string> = {
  hindi: 'hi', english: 'en', telugu: 'te', tamil: 'ta', bengali: 'bn',
  punjabi: 'pa', urdu: 'ur', marathi: 'mr', gujarati: 'gu', kannada: 'kn',
  malayalam: 'ml', french: 'fr', spanish: 'es', german: 'de', italian: 'it',
  portuguese: 'pt', russian: 'ru', japanese: 'ja', korean: 'ko',
  chinese: 'zh', arabic: 'ar', turkish: 'tr',
};

function shouldUseSarvam(languagePreferences?: string[]): boolean {
  if (!languagePreferences?.length) return true; // Default to Sarvam (Indian user base)
  const primary = languagePreferences[0].toLowerCase();
  if (WHISPER_ONLY_LANGUAGES.has(primary)) return false;
  return true;
}

async function transcribeWithSarvam(
  audioBlob: Blob,
  languagePreferences?: string[],
): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.m4a');
  formData.append('model', 'saaras:v3');
  formData.append('mode', 'transcribe');

  // Set language code if we can map it, otherwise let Sarvam auto-detect
  if (languagePreferences?.length) {
    const primary = languagePreferences[0].toLowerCase();
    const langCode = SARVAM_LANGUAGES[primary];
    if (langCode) {
      formData.append('language_code', langCode);
    } else {
      formData.append('language_code', 'unknown');
    }
  } else {
    formData.append('language_code', 'unknown');
  }

  const response = await fetch('https://api.sarvam.ai/speech-to-text', {
    method: 'POST',
    headers: {
      'api-subscription-key': SARVAM_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Sarvam API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.transcript || '';
}

async function transcribeWithWhisper(
  audioBlob: Blob,
  languagePreferences?: string[],
): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.m4a');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'text');

  if (languagePreferences?.length) {
    const primary = languagePreferences[0].toLowerCase();
    const langCode = WHISPER_LANG_MAP[primary] || primary;
    if (langCode.length === 2) {
      formData.append('language', langCode);
    }
  }

  formData.append(
    'prompt',
    'This is a family story or memory being recorded by an elder for their grandchildren. It may contain multiple languages mixed together.',
  );

  const response = await fetch(
    'https://api.openai.com/v1/audio/transcriptions',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: formData,
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Whisper API error (${response.status}): ${errorText}`);
  }

  return (await response.text()).trim();
}

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

    // Fetch audio from storage
    const audioResponse = await fetch(audio_url);
    if (!audioResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch audio file' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const audioBlob = await audioResponse.blob();
    const useSarvam = shouldUseSarvam(language_preferences);
    let transcript: string;
    let provider: 'sarvam' | 'whisper';

    if (useSarvam) {
      // Try Sarvam first, fall back to Whisper
      try {
        transcript = await transcribeWithSarvam(audioBlob, language_preferences);
        provider = 'sarvam';
        console.log('Transcribed with Sarvam');
      } catch (sarvamError) {
        console.warn('Sarvam failed, falling back to Whisper:', sarvamError);
        transcript = await transcribeWithWhisper(audioBlob, language_preferences);
        provider = 'whisper';
        console.log('Transcribed with Whisper (fallback)');
      }
    } else {
      // Non-Indian language — go straight to Whisper
      transcript = await transcribeWithWhisper(audioBlob, language_preferences);
      provider = 'whisper';
      console.log('Transcribed with Whisper (non-Indian language)');
    }

    return new Response(
      JSON.stringify({ transcript, provider }),
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
