import { CORS_HEADERS } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabase-admin.ts';
import type { CallBrief, ProviderTurnEvent, ProviderCallEndEvent } from '../_shared/types.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SARVAM_API_KEY = Deno.env.get('SARVAM_API_KEY')!;
const SARVAM_BASE = Deno.env.get('SARVAM_BASE_URL') ?? 'https://api.sarvam.ai';
const SARVAM_VOICE = Deno.env.get('SARVAM_VOICE_ID') ?? 'meera';
const PROVIDER_MODE = (Deno.env.get('PROVIDER_MODE') ?? 'production') as 'mock' | 'production';

interface StartRequest {
  call_id: string;
  brief: CallBrief;
  system_prompt: string;
}

export async function handleStart(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  const expected = `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`;
  if (auth !== expected) {
    return new Response('Unauthorized — service role only', { status: 403, headers: CORS_HEADERS });
  }

  const body = (await req.json()) as StartRequest;
  const supabase = getAdminClient();

  const { data: elder, error: elderErr } = await supabase
    .from('elders')
    .select('phone_number_encrypted, country')
    .eq('id', body.brief.elder_id)
    .single();
  if (elderErr || !elder) {
    return new Response(`Elder not found: ${elderErr?.message}`, { status: 404 });
  }

  const { data: phone, error: phoneErr } = await supabase.rpc('get_elder_phone_e164', {
    elder_id_arg: body.brief.elder_id,
  });
  if (phoneErr || !phone) {
    return new Response(`Phone decrypt failed: ${phoneErr?.message}`, { status: 500 });
  }

  const webhookUrl = `${SUPABASE_URL}/functions/v1/call-orchestrator/webhook`;

  await supabase
    .from('calls')
    .update({ status: 'dialing', provider: PROVIDER_MODE === 'mock' ? 'mock' : 'sarvam' })
    .eq('id', body.call_id);

  if (PROVIDER_MODE === 'mock') {
    const mockCallId = `mock-${body.call_id}`;
    await supabase
      .from('calls')
      .update({ provider_call_id: mockCallId })
      .eq('id', body.call_id);
    return new Response(JSON.stringify({ provider_call_id: mockCallId }), {
      status: 200, headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    });
  }

  // TODO: Replace with Plivo + Pipecat orchestrator. Sarvam does not expose
  // a managed voice-bot endpoint (see docs/superpowers/research/sarvam-capabilities.md).
  // This branch is non-functional in production until that integration ships.
  if (elder.country !== 'IN') {
    await supabase.from('calls').update({ status: 'failed' }).eq('id', body.call_id);
    return new Response('Only IN supported in MVP', { status: 400 });
  }

  const sarvamPayload = {
    to: phone,
    language: body.brief.language,
    voice_id: SARVAM_VOICE,
    system_prompt: body.system_prompt,
    first_message_audio_url: body.brief.is_first_call ? body.brief.family_intro_audio_url : undefined,
    webhook_url: webhookUrl,
    metadata: { call_id: body.call_id },
  };

  const sarvamRes = await fetch(`${SARVAM_BASE}/voice-bot/start`, {
    method: 'POST',
    headers: {
      'api-subscription-key': SARVAM_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify(sarvamPayload),
  });
  if (!sarvamRes.ok) {
    const text = await sarvamRes.text();
    await supabase.from('calls').update({ status: 'failed' }).eq('id', body.call_id);
    return new Response(`Sarvam start failed ${sarvamRes.status}: ${text}`, { status: 502 });
  }
  const sarvamJson = (await sarvamRes.json()) as { call_id: string };

  await supabase
    .from('calls')
    .update({ provider_call_id: sarvamJson.call_id })
    .eq('id', body.call_id);

  return new Response(JSON.stringify({ provider_call_id: sarvamJson.call_id }), {
    status: 200, headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
}

export async function handleWebhookCallStart(body: { provider_call_id: string; metadata?: { call_id?: string } }): Promise<Response> {
  const supabase = getAdminClient();

  const { data: existing, error: lookupErr } = await supabase
    .from('calls')
    .select('id')
    .eq('provider_call_id', body.provider_call_id)
    .single();
  if (lookupErr || !existing) {
    return new Response('Unknown call', { status: 404 });
  }

  await supabase
    .from('calls')
    .update({ status: 'in_progress', started_at: new Date().toISOString() })
    .eq('provider_call_id', body.provider_call_id);

  return new Response('ok', { status: 200 });
}

const HF_TOKEN = Deno.env.get('HUGGINGFACE_TOKEN')!;
const SAME_SPEAKER_THRESHOLD = 0.75;

// Mirrors normalizePyannoteEmbedding in packages/ai/src/voiceprint.ts.
// Deno cannot import from @katha/ai — keep both in sync when changing shape logic.
function normalizePyannoteEmbedding(parsed: unknown): number[] {
  let candidate: unknown = parsed;
  if (parsed && typeof parsed === 'object' && 'embedding' in parsed) {
    candidate = (parsed as { embedding: unknown }).embedding;
  }
  if (Array.isArray(candidate) && Array.isArray(candidate[0])) {
    candidate = (candidate as number[][])[0];
  }
  if (!Array.isArray(candidate) || candidate.length === 0 || typeof candidate[0] !== 'number') {
    throw new Error(
      `Unexpected pyannote response shape: ${JSON.stringify(parsed).slice(0, 200)}`,
    );
  }
  if (candidate.length !== 512) {
    throw new Error(`Unexpected voiceprint length ${candidate.length}; expected 512`);
  }
  return candidate as number[];
}

async function extractVoiceprintHF(audioUrl: string): Promise<number[]> {
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) throw new Error(`Could not fetch audio: ${audioRes.status}`);
  const audio = await audioRes.arrayBuffer();

  // Direct HTTP to HF Inference — pyannote/embedding is not exposed as a typed method
  // in @huggingface/inference SDK v4 (see Phase 3 findings).
  const hfRes = await fetch('https://api-inference.huggingface.co/models/pyannote/embedding', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HF_TOKEN}`,
      'Content-Type': 'audio/flac',
    },
    body: audio,
  });
  if (!hfRes.ok) {
    const text = await hfRes.text();
    throw new Error(`HF inference failed ${hfRes.status}: ${text}`);
  }
  const parsed = await hfRes.json();
  return normalizePyannoteEmbedding(parsed);
}

function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// 6.4-bis: extract structured cues from an elder turn via Haiku
async function extractCuesQuick(transcript: string, language: string): Promise<Record<string, unknown>> {
  if (!transcript.trim()) return {};
  try {
    const { default: Anthropic } = await import('npm:@anthropic-ai/sdk@0.95.1');
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      temperature: 0.1,
      system: `Extract structured cues from an elder's spoken turn. Return JSON: {"time_capsule": {"recipient": "...", "condition": "..."} | null, "advice": {"topic": "..."} | null, "distress": {"severity": "mild|moderate|severe"} | null, "cadence": {"request": "..."} | null, "sharing_request": {"recipient_label": "..."} | null}. Set keys to null if not present.`,
      messages: [{ role: 'user', content: `Language: ${language}\nTurn: ${transcript}` }],
    });
    const block = res.content.find((b: { type: string }) => b.type === 'text') as { type: 'text'; text: string } | undefined;
    if (!block) return {};
    const fenced = /```(?:json)?\n([\s\S]*?)\n```/.exec(block.text);
    return JSON.parse(fenced ? fenced[1] : block.text);
  } catch (_) {
    return {};
  }
}

// 6.4-ter: detect explicit consent statements in an elder turn via Haiku
async function detectConsents(transcript: string, language: string): Promise<Array<{ type: string; granted: boolean }>> {
  if (!transcript.trim()) return [];
  try {
    const { default: Anthropic } = await import('npm:@anthropic-ai/sdk@0.95.1');
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      temperature: 0.1,
      system: `Detect explicit yes/no consent statements in an elder's spoken turn. Categories: "recording", "family_sharing", "persona_use", "voice_cloning", "external_share". Return JSON: {"consents": [{"type": "recording", "granted": true}, ...]}. Empty array if none.`,
      messages: [{ role: 'user', content: `Language: ${language}\nTurn: ${transcript}` }],
    });
    const block = res.content.find((b: { type: string }) => b.type === 'text') as { type: 'text'; text: string } | undefined;
    if (!block) return [];
    const fenced = /```(?:json)?\n([\s\S]*?)\n```/.exec(block.text);
    const parsed = JSON.parse(fenced ? fenced[1] : block.text);
    return parsed.consents ?? [];
  } catch (_) {
    return [];
  }
}

export async function handleWebhookTurn(body: ProviderTurnEvent & { event: 'turn' }): Promise<Response> {
  const supabase = getAdminClient();

  const { data: call, error: callErr } = await supabase
    .from('calls')
    .select('id, elder_id, is_first_call')
    .eq('provider_call_id', body.provider_call_id)
    .single();
  if (callErr || !call) return new Response('Unknown call', { status: 404 });

  let voiceScore: number | null = null;

  if (body.speaker === 'elder') {
    try {
      const turnEmbedding = await extractVoiceprintHF(body.audio_clip_url);

      const { data: elder } = await supabase
        .from('elders')
        .select('voiceprint')
        .eq('id', call.elder_id)
        .single();

      if (elder?.voiceprint && Array.isArray(elder.voiceprint)) {
        voiceScore = cosine(turnEmbedding, elder.voiceprint as number[]);
      } else if (call.is_first_call) {
        // Enroll voiceprint on first elder turn that is long enough to be reliable.
        const turnDurationMs = body.ended_at_ms - body.started_at_ms;
        if (turnDurationMs >= 3000) {
          await supabase
            .from('elders')
            .update({
              voiceprint: turnEmbedding,
              voiceprint_enrolled_at: new Date().toISOString(),
            })
            .eq('id', call.elder_id);
          voiceScore = 1.0;
        }
      }
    } catch (e) {
      console.error('Voiceprint failed:', e);
    }
  }

  // 6.4-bis: cue extraction for elder turns with transcript
  let cues: Record<string, unknown> = {};
  if (body.speaker === 'elder' && body.transcript) {
    cues = await extractCuesQuick(body.transcript, body.language);
  }

  // 6.4-ter: consent capture during first call elder turns
  if (call.is_first_call && body.speaker === 'elder' && body.transcript) {
    const consents = await detectConsents(body.transcript, body.language);
    for (const c of consents) {
      await supabase.from('elder_consents').insert({
        elder_id: call.elder_id,
        consent_type: c.type,
        granted: c.granted,
        audio_url: body.audio_clip_url,
        transcript: body.transcript,
        language: body.language,
        call_id: call.id,
      });
    }
  }

  await supabase.from('call_turns').insert({
    call_id: call.id,
    speaker: body.speaker,
    audio_clip_url: body.audio_clip_url,
    transcript: body.transcript,
    language: body.language,
    started_at_ms: body.started_at_ms,
    ended_at_ms: body.ended_at_ms,
    voice_verification_score: voiceScore,
    cues,
  });

  return new Response('ok', { status: 200 });
}

export async function handleWebhookCallEnd(body: ProviderCallEndEvent & { event: 'call_ended' }): Promise<Response> {
  const supabase = getAdminClient();

  const { data: call, error: callErr } = await supabase
    .from('calls')
    .select('id, voice_verification_score')
    .eq('provider_call_id', body.provider_call_id)
    .single();
  if (callErr || !call) return new Response('Unknown call', { status: 404 });

  // Aggregate voice verification score across all elder turns in the call.
  const { data: turns } = await supabase
    .from('call_turns')
    .select('voice_verification_score, speaker')
    .eq('call_id', call.id)
    .eq('speaker', 'elder');
  const elderScores = (turns ?? [])
    .map((t: { voice_verification_score: number | null }) => t.voice_verification_score)
    .filter((s): s is number => typeof s === 'number');
  const aggregate =
    elderScores.length > 0
      ? elderScores.reduce((a, b) => a + b, 0) / elderScores.length
      : null;

  await supabase
    .from('calls')
    .update({
      status: body.status,
      ended_at: new Date().toISOString(),
      duration_seconds: body.duration_seconds,
      recording_url: body.recording_url,
      cost_cents: body.cost_cents,
      voice_verification_score: aggregate,
    })
    .eq('id', call.id);

  if (body.status === 'completed') {
    const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/post-call-process`;
    fetch(url, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ call_id: call.id }),
    }).catch((e: Error) => console.error('post-call-process trigger failed', e));
    // fire-and-forget; ack webhook immediately
  }

  return new Response('ok', { status: 200 });
}
