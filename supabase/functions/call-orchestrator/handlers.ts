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
  // Implemented in Task 6.3
  throw new Error('handleWebhookCallStart: not yet implemented (Task 6.3)');
}

export async function handleWebhookTurn(body: ProviderTurnEvent & { event: 'turn' }): Promise<Response> {
  // Implemented in Task 6.4
  throw new Error('handleWebhookTurn: not yet implemented (Task 6.4)');
}

export async function handleWebhookCallEnd(body: ProviderCallEndEvent & { event: 'call_ended' }): Promise<Response> {
  // Implemented in Task 6.5
  throw new Error('handleWebhookCallEnd: not yet implemented (Task 6.5)');
}
