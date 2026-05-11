import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { CORS_HEADERS, handleCorsPreflight } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabase-admin.ts';
import { assembleBrief, buildSystemPrompt } from './brief.ts';

interface ScheduleCallRequest {
  elder_id: string;
  scheduled_at?: string;     // ISO; default: now
  family_suggested_question?: string;
}

Deno.serve(async (req) => {
  const cors = handleCorsPreflight(req);
  if (cors) return cors;

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  let body: ScheduleCallRequest;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: CORS_HEADERS });
  }

  if (!body.elder_id) {
    return new Response('elder_id required', { status: 400, headers: CORS_HEADERS });
  }

  const supabase = getAdminClient();

  // Load elder
  const { data: elder, error: elderErr } = await supabase
    .from('elders')
    .select('id, family_id, display_name, preferred_name, relationship_label, language, family_intro_audio_url, voiceprint, status')
    .eq('id', body.elder_id)
    .single();
  if (elderErr || !elder) {
    return new Response(`Elder not found: ${elderErr?.message}`, { status: 404, headers: CORS_HEADERS });
  }

  // Load recent call summaries (last 3)
  const { data: recentCalls } = await supabase
    .from('calls')
    .select('summary, theme')
    .eq('elder_id', body.elder_id)
    .eq('status', 'completed')
    .order('ended_at', { ascending: false })
    .limit(3);
  const recent_call_summaries = (recentCalls ?? []).map((c) => c.summary ?? '').filter(Boolean);
  const recent_themes = (recentCalls ?? []).map((c) => c.theme ?? '').filter(Boolean);

  // Assemble brief
  const brief = assembleBrief({
    elder: {
      id: elder.id,
      display_name: elder.display_name,
      preferred_name: elder.preferred_name,
      relationship_label: elder.relationship_label,
      language: elder.language,
      family_intro_audio_url: elder.family_intro_audio_url,
      voiceprint: elder.voiceprint as number[] | null,
      status: elder.status,
    },
    recent_call_summaries,
    recent_themes,
    family_suggested_questions: body.family_suggested_question ? [body.family_suggested_question] : [],
  });

  const systemPrompt = buildSystemPrompt(brief);

  // Insert calls row
  const { data: call, error: callErr } = await supabase
    .from('calls')
    .insert({
      elder_id: elder.id,
      family_id: elder.family_id,
      scheduled_at: body.scheduled_at ?? new Date().toISOString(),
      status: 'scheduled',
      theme: brief.this_week_theme,
      brief_json: brief,
      language: brief.language,
      is_first_call: brief.is_first_call,
    })
    .select('id')
    .single();
  if (callErr || !call) {
    return new Response(`Insert failed: ${callErr?.message}`, { status: 500, headers: CORS_HEADERS });
  }

  // Kick off the actual provider call. We delegate to the call-orchestrator's start endpoint
  // (to keep provider logic in one place). The orchestrator function wraps the @katha/calling
  // provider selector + startCall.
  const orchestratorUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/call-orchestrator/start`;
  const orchestratorRes = await fetch(orchestratorUrl, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      call_id: call.id,
      brief,
      system_prompt: systemPrompt,
    }),
  });

  if (!orchestratorRes.ok) {
    const text = await orchestratorRes.text();
    await supabase.from('calls').update({ status: 'failed' }).eq('id', call.id);
    return new Response(`Orchestrator start failed: ${text}`, { status: 502, headers: CORS_HEADERS });
  }

  return new Response(JSON.stringify({ call_id: call.id, brief }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
});
