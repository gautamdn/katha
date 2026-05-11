import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { CORS_HEADERS, handleCorsPreflight } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabase-admin.ts';
import Anthropic from 'npm:@anthropic-ai/sdk@0.95.1';
import OpenAI from 'npm:openai@6.37.0';
import { generateJSON, MODELS } from './lib/anthropic.ts';
import { EMBEDDING_MODEL } from './lib/embeddings.ts';

interface QARequest {
  elder_id: string;
  question: string;
  top_k?: number;
}

interface QACitation {
  text: string;
  audio_clip_url: string | null;
  call_date: string | null;
  similarity: number;
  fact_type: string;
}

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

Deno.serve(async (req) => {
  const cors = handleCorsPreflight(req);
  if (cors) return cors;
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return new Response('Missing authorization', { status: 401, headers: CORS_HEADERS });
  }

  const body = (await req.json()) as QARequest;
  if (!body.elder_id || !body.question) {
    return new Response('elder_id and question required', { status: 400 });
  }
  const topK = body.top_k ?? 6;

  // Verify caller has access to this elder via RLS before using admin client.
  const userScopedClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: elderCheck, error: elderErr } = await userScopedClient
    .from('elders')
    .select('id')
    .eq('id', body.elder_id)
    .single();
  if (elderErr || !elderCheck) {
    return new Response('Elder not found or not accessible', { status: 404, headers: CORS_HEADERS });
  }

  const supabase = getAdminClient();
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  // 1. Embed question
  const qEmb = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: body.question,
  });
  const qVec = qEmb.data[0].embedding;

  // 2. Retrieve from persona_index via RPC (cosine similarity)
  // We need an RPC because supabase-js doesn't support pgvector ops directly.
  const { data: matches, error: matchErr } = await supabase.rpc('search_persona_index', {
    elder_id_arg: body.elder_id,
    query_embedding: qVec,
    match_count: topK,
  });
  if (matchErr) {
    return new Response(`Search failed: ${matchErr.message}`, { status: 500 });
  }

  if (!matches || (matches as unknown[]).length === 0) {
    return new Response(JSON.stringify({
      answer: "I don't have anything from her about that yet — would you like to ask in your next call?",
      citations: [],
    }), { status: 200, headers: { ...CORS_HEADERS, 'content-type': 'application/json' } });
  }

  // 3. Compose answer with Claude Sonnet, grounded only in citations
  type Match = {
    fact_text: string;
    fact_type: string;
    audio_clip_url: string | null;
    similarity: number;
    call_started_at: string | null;
  };
  const typedMatches = matches as Match[];

  const citationsBlock = typedMatches.map((m, i) =>
    `[${i + 1}] (${m.fact_type}, ${m.call_started_at ?? 'unknown date'}): ${m.fact_text}`
  ).join('\n');

  const result = await generateJSON<{ answer: string; cited: number[] }>({
    client: anthropic,
    model: MODELS.sonnet,
    systemPrompt: `You answer questions about an elder family member based ONLY on a provided list of distilled facts from their recorded calls. You must:
- Quote or paraphrase from the facts; never invent.
- If the facts don't actually answer the question, say so warmly.
- Use the elder's voice and idiom where preserved.
- Return JSON: {"answer": "...", "cited": [1,2,3]} (cited is the 1-based indices of facts you used).`,
    userPrompt: `Question: ${body.question}

Facts:
${citationsBlock}

Answer using only these facts.`,
    schema: {},
    maxTokens: 1024,
    temperature: 0.3,
  });

  const citations: QACitation[] = (result.cited ?? []).map((i) => {
    const m = typedMatches[i - 1];
    if (!m) return null;
    return {
      text: m.fact_text,
      audio_clip_url: m.audio_clip_url,
      call_date: m.call_started_at,
      similarity: m.similarity,
      fact_type: m.fact_type,
    };
  }).filter((c): c is QACitation => c !== null);

  return new Response(JSON.stringify({ answer: result.answer, citations }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
});
