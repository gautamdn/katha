/**
 * Supabase Edge Function: Generate Metadata
 *
 * Takes polished text and returns AI-generated metadata using Claude Haiku.
 *
 * POST /generate-metadata
 * Body: { text: string }
 * Returns: { title, excerpt, category, mood, read_time_minutes }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

const SYSTEM_PROMPT = `You are a metadata generator for a family legacy journal called Katha.
Given a story/memory written by an elder for their grandchildren, generate:

1. title: A warm, evocative title (max 60 characters). Not generic — capture the essence.
2. excerpt: A compelling 1-2 sentence preview (max 150 characters).
3. category: Exactly one of: childhood, wisdom, family, festival, recipe, love_story, life_lesson, prayer, tradition, adventure, funny_story, bedtime_story, letter, other
4. mood: Exactly one of: nostalgic, joyful, reflective, funny, tender, proud, bittersweet, hopeful, peaceful, celebratory
5. read_time_minutes: Estimated reading time in minutes (integer, minimum 1)

Return ONLY valid JSON with these 5 fields. No markdown, no explanation.`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  let text = '';

  try {
    const body = await req.json();
    text = body.text;

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing required field: text' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Generate metadata for this story:\n\n${text}`,
          },
        ],
      }),
    });

    const data = await response.json();
    const rawOutput = data.content?.[0]?.text || '{}';
    const metadata = JSON.parse(rawOutput);

    const result = {
      title: metadata.title || 'Untitled Story',
      excerpt: metadata.excerpt || text.substring(0, 150),
      category: metadata.category || 'other',
      mood: metadata.mood || 'reflective',
      read_time_minutes: Math.max(
        1,
        Math.round(
          metadata.read_time_minutes || Math.ceil(text.split(/\s+/).length / 200),
        ),
      ),
    };

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  } catch (error) {
    console.error('Metadata generation error:', error);

    // Fallback: generate basic metadata without AI
    const wordCount = text?.split(/\s+/).length || 0;
    return new Response(
      JSON.stringify({
        title: 'Untitled Story',
        excerpt: (text || '').substring(0, 150),
        category: 'other',
        mood: 'reflective',
        read_time_minutes: Math.max(1, Math.ceil(wordCount / 200)),
      }),
      { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    );
  }
});
