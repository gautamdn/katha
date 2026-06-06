import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import ws from 'ws';
config();

type Lang = 'kn' | 'gu';

interface LangDefault {
  voice: string;
  text: string;
  languageCode: string;
}

// Per docs/superpowers/research/sarvam-capabilities.md: voice ↔ language mapping
// is not documented. Picks here are starting candidates from the warm/female set
// {Ritu, Priya, Suhani, Kavitha, Shruti}; swap with --voice and re-run if a
// voice sounds wrong during the hello-world dial.
const DEFAULTS: Record<Lang, LangDefault> = {
  kn: {
    voice: 'Ritu',
    text: 'Namaste Ajji, idu Susheela. Hyange idira?',
    languageCode: 'kn-IN',
  },
  gu: {
    voice: 'Priya',
    text: 'Namaste Ba, hu Susheela chhu. Tame kem chho?',
    languageCode: 'gu-IN',
  },
};

interface Args {
  lang: Lang;
  voice: string;
  text: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let lang: string | undefined;
  let voice: string | undefined;
  let text: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--lang') lang = argv[++i];
    else if (arg === '--voice') voice = argv[++i];
    else if (arg === '--text') text = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (lang !== 'kn' && lang !== 'gu') {
    throw new Error('--lang must be "kn" or "gu"');
  }
  const d = DEFAULTS[lang];
  return { lang, voice: voice ?? d.voice, text: text ?? d.text };
}

async function main() {
  const { lang, voice, text } = parseArgs();
  const languageCode = DEFAULTS[lang].languageCode;

  const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SARVAM_API_KEY) throw new Error('SARVAM_API_KEY not set');
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL not set');
  if (!SERVICE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');

  // 8000 Hz matches PSTN; Sarvam docs warn that mismatched rates produce
  // chipmunk/slow-motion artifacts.
  const ttsRes = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: {
      'api-subscription-key': SARVAM_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      inputs: [text],
      target_language_code: languageCode,
      speaker: voice,
      model: 'bulbul:v3',
      speech_sample_rate: 8000,
    }),
  });

  if (!ttsRes.ok) {
    const errText = await ttsRes.text();
    throw new Error(`Sarvam TTS failed (${ttsRes.status}): ${errText}`);
  }

  const payload = (await ttsRes.json()) as { audios?: string[] };
  if (!payload.audios?.[0]) {
    throw new Error(`Sarvam TTS returned no audio: ${JSON.stringify(payload)}`);
  }
  const wavBytes = Buffer.from(payload.audios[0], 'base64');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    realtime: { transport: ws as any },
  });

  const objectPath = `_susheela-hello/${lang}.${voice}.wav`;
  const { error: uploadErr } = await supabase.storage
    .from('audio-playback')
    .upload(objectPath, wavBytes, { contentType: 'audio/wav', upsert: true });
  if (uploadErr) throw uploadErr;

  const ONE_YEAR_S = 60 * 60 * 24 * 365;
  const { data: signed, error: signErr } = await supabase.storage
    .from('audio-playback')
    .createSignedUrl(objectPath, ONE_YEAR_S);
  if (signErr || !signed) {
    throw signErr ?? new Error('createSignedUrl returned no data');
  }

  console.log(`lang=${lang}`);
  console.log(`voice=${voice}`);
  console.log(`object=audio-playback/${objectPath}`);
  console.log(`signed_url=${signed.signedUrl}`);
  console.log('');
  console.log('Next: supabase secrets set --project-ref $SUPABASE_PROJECT_REF \\');
  console.log(`  AUDIO_HELLO_URL_${lang.toUpperCase()}="${signed.signedUrl}"`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
