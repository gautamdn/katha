import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { CORS_HEADERS, handleCorsPreflight } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabase-admin.ts';
import Anthropic from 'npm:@anthropic-ai/sdk@0.95.1';
import OpenAI from 'npm:openai@6.37.0';
import { extractStories } from './lib/extract-stories.ts';
import { extractPersonaFacts } from './lib/extract-persona-facts.ts';
import { embedBatch } from './lib/embeddings.ts';
import { MODELS, generateJSON } from './lib/anthropic.ts';

interface PostCallRequest { call_id: string; }

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

Deno.serve(async (req) => {
  const cors = handleCorsPreflight(req);
  if (cors) return cors;
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const body = (await req.json()) as PostCallRequest;
  if (!body.call_id) return new Response('call_id required', { status: 400 });

  const supabase = getAdminClient();
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  // Load call + elder + turns
  const { data: call } = await supabase
    .from('calls')
    .select('id, elder_id, family_id, language, is_first_call, theme')
    .eq('id', body.call_id)
    .single();
  if (!call) return new Response('Call not found', { status: 404 });

  const { data: elder } = await supabase
    .from('elders')
    .select('display_name, preferred_name, relationship_label')
    .eq('id', call.elder_id)
    .single();
  if (!elder) return new Response('Elder not found', { status: 404 });

  const { data: turns } = await supabase
    .from('call_turns')
    .select('id, speaker, transcript, language, voice_verification_score, audio_clip_url')
    .eq('call_id', body.call_id)
    .order('started_at_ms', { ascending: true });
  if (!turns || turns.length === 0) {
    await supabase.from('calls').update({ summary: 'No turns captured.' }).eq('id', body.call_id);
    return new Response(JSON.stringify({ stories: 0, persona_facts: 0 }), {
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    });
  }

  const elderName = elder.preferred_name ?? elder.display_name;
  const turnInputs = turns.map((t) => ({
    id: t.id,
    speaker: t.speaker,
    transcript: t.transcript ?? '',
    language: t.language ?? call.language,
  }));

  // 1. Extract stories
  const stories = await extractStories({ client: anthropic, turns: turnInputs, elderName });

  // 2. Insert each story into capsules table
  for (const story of stories) {
    // voice_verified: true only if all source elder turns have score >= threshold
    const sourceTurns = turns.filter((t) => story.source_turn_ids.includes(t.id) && t.speaker === 'elder');
    const voiceVerified = sourceTurns.length > 0 && sourceTurns.every(
      (t) => typeof t.voice_verification_score === 'number' && t.voice_verification_score >= 0.75,
    );

    // Generate metadata via existing generate-metadata function (Claude Haiku)
    const metaRes = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-metadata`,
      {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ text: story.polished_text }),
      },
    );
    const metadata = metaRes.ok ? await metaRes.json() : { excerpt: null, category: null, mood: null, read_time_minutes: 1 };

    await supabase.from('capsules').insert({
      family_id: call.family_id,
      elder_id: call.elder_id,
      writer_id: null,
      raw_text: turnInputs.filter((t) => story.source_turn_ids.includes(t.id)).map((t) => t.transcript).join('\n\n'),
      polished_text: story.polished_text,
      title: story.title,
      excerpt: metadata.excerpt,
      category: metadata.category,
      mood: metadata.mood,
      read_time_minutes: metadata.read_time_minutes ?? 1,
      language: story.language,
      source_call_id: body.call_id,
      source_turn_ids: story.source_turn_ids,
      voice_verified: voiceVerified,
      privacy_flag: 'family',
      is_draft: false,
      is_unlocked: true,
      published_at: new Date().toISOString(),
    });
  }

  // 3. Extract persona facts (only voice-verified elder turns)
  const verifiedTurns = turnInputs.filter((t) => {
    const orig = turns.find((x) => x.id === t.id);
    return t.speaker === 'elder'
      && typeof orig?.voice_verification_score === 'number'
      && (orig.voice_verification_score as number) >= 0.75;
  });

  const facts = verifiedTurns.length > 0
    ? await extractPersonaFacts({ client: anthropic, turns: verifiedTurns, elderName })
    : [];

  if (facts.length > 0) {
    const factEmbeddings = await embedBatch(openai, facts.map((f) => f.text));
    const personaRows = facts.map((fact, i) => {
      const turn = turns.find((t) => t.id === fact.source_turn_id);
      return {
        elder_id: call.elder_id,
        source_turn_id: fact.source_turn_id,
        source_call_id: body.call_id,
        fact_type: fact.fact_type,
        text: fact.text,
        audio_clip_url: turn?.audio_clip_url ?? null,
        embedding: factEmbeddings[i],
        confidence: fact.confidence,
        voice_verified: true,
        language: fact.language,
      };
    });
    await supabase.from('persona_index').insert(personaRows);
  }

  // 4. Embed each call_turn for retrieval queries (only elder turns with content)
  const turnsToEmbed = turns.filter((t) => t.speaker === 'elder' && t.transcript && t.transcript.trim().length > 0);
  if (turnsToEmbed.length > 0) {
    const turnEmbeddings = await embedBatch(openai, turnsToEmbed.map((t) => t.transcript ?? ''));
    for (let i = 0; i < turnsToEmbed.length; i++) {
      await supabase
        .from('call_turns')
        .update({ embedding: turnEmbeddings[i] })
        .eq('id', turnsToEmbed[i].id);
    }
  }

  // 5. Generate a short call summary for next call's brief
  const summaryRes = await generateJSON<{ summary: string }>({
    client: anthropic,
    model: MODELS.haiku,
    systemPrompt: `Summarize this call in 1-2 sentences for use as context in the next call. Focus on what ${elderName} talked about and any threads to revisit.`,
    userPrompt: `Theme: ${call.theme}\nTurns:\n${turnInputs.map((t) => `${t.speaker}: ${t.transcript}`).join('\n')}\n\nReturn JSON: {"summary": "..."}`,
    schema: {},
    maxTokens: 256,
    temperature: 0.3,
  });

  // 6. If first call, mark elder active
  if (call.is_first_call) {
    await supabase.from('elders').update({ status: 'active' }).eq('id', call.elder_id);
  }

  await supabase.from('calls').update({ summary: summaryRes.summary }).eq('id', body.call_id);

  return new Response(JSON.stringify({
    stories: stories.length,
    persona_facts: facts.length,
    turns_embedded: turnsToEmbed.length,
  }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
});
