/**
 * Supabase Edge Function: AI Polish
 * 
 * Takes raw text from a writer and returns polished version using Claude API.
 * Preserves cultural expressions, code-switching, and the writer's voice.
 * 
 * POST /ai-polish
 * Body: { text: string, language_preferences?: string[] }
 * Returns: { polished_text: string, changes_summary: string }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

const SYSTEM_PROMPT = `You are a gentle editor for a family legacy journal called Katha.
The writer is an elder — a grandparent, parent, or family member — recording memories, stories, and wisdom for their grandchildren.

Your job is to polish their writing while keeping their authentic voice:

RULES:
1. Fix grammar, spelling, and punctuation
2. Improve flow and readability where needed
3. PRESERVE all cultural expressions, proverbs, idioms, and blessings
4. KEEP all non-English words and phrases exactly as written (Hindi, Urdu, Telugu, Tamil, Punjabi, Bengali, etc.)
5. KEEP code-switching and language mixing (e.g., Hinglish) — this is intentional and beautiful
6. Maintain the writer's natural warmth, humor, and personality
7. Do NOT make it sound "professional" or "literary" — keep it personal and conversational
8. Preserve dialectal expressions and colloquialisms
9. Keep the original structure and paragraph breaks
10. If the text is already good, make minimal changes

Return ONLY the polished text. No explanations, no notes.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { text, language_preferences } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing required field: text' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const languageContext = language_preferences?.length
      ? `\n\nThe writer's preferred languages include: ${language_preferences.join(', ')}. Pay special attention to preserving words and phrases from these languages.`
      : '';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT + languageContext,
        messages: [
          {
            role: 'user',
            content: `Please polish this writing:\n\n${text}`,
          },
        ],
      }),
    });

    const data = await response.json();
    const polished_text = data.content?.[0]?.text || text;

    return new Response(
      JSON.stringify({
        polished_text,
        changes_summary: polished_text === text ? 'No changes needed' : 'Grammar and flow improved',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('AI polish error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to polish text' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
