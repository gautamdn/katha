/**
 * Supabase Edge Function: Smart Prompts
 *
 * Generates 3 culturally relevant writing prompts using Claude Sonnet.
 * Considers writer's languages, children's ages, and previously covered categories.
 *
 * POST /smart-prompts
 * Body: {
 *   writer_id: string,
 *   language_preferences?: string[],
 *   children_ages?: number[],
 *   previous_categories?: string[]
 * }
 * Returns: { prompts: [{ text, category, why }] }
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

const SYSTEM_PROMPT = `You are a writing prompt generator for Katha, a family legacy app where grandparents and elders record stories, memories, and wisdom for their grandchildren.

Generate exactly 3 warm, culturally sensitive writing prompts that inspire personal storytelling.

Guidelines:
- Prompts should be specific enough to spark a memory but open enough for any family
- Consider cultural context: festivals, food traditions, family customs, rituals, rites of passage
- Mix categories: one about the past (memory), one about wisdom/advice, one about family/love
- If children's ages are given, tailor prompts to what would be meaningful to those age groups
- If language preferences are given, consider cultural contexts of those languages
- Avoid repeating categories the writer has already covered
- Keep prompts warm, inviting, and not too formal
- Each prompt should feel like a gentle question from a friend

Available categories: childhood, wisdom, family, festival, recipe, love_story, life_lesson, prayer, tradition, adventure, funny_story, bedtime_story, letter, other

Return valid JSON only: { "prompts": [{ "text": "...", "category": "...", "why": "..." }] }`;

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
    const {
      writer_id,
      language_preferences,
      children_ages,
      previous_categories,
    } = await req.json();

    const contextParts: string[] = [];
    if (language_preferences?.length) {
      contextParts.push(
        `Writer's languages: ${language_preferences.join(', ')}`,
      );
    }
    if (children_ages?.length) {
      contextParts.push(
        `Children's ages: ${children_ages.join(', ')}`,
      );
    }
    if (previous_categories?.length) {
      contextParts.push(
        `Categories already covered (avoid repeating): ${previous_categories.join(', ')}`,
      );
    }

    const userMessage = contextParts.length
      ? `Generate 3 writing prompts for this writer.\n\nContext:\n${contextParts.join('\n')}`
      : 'Generate 3 writing prompts for a family story writer.';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Parse the JSON response from Claude
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse prompts JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(parsed), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Smart prompts error:', error);

    // Return fallback prompts
    return new Response(
      JSON.stringify({
        prompts: [
          {
            text: 'What is your earliest childhood memory? Describe the sights, sounds, and smells you remember.',
            category: 'childhood',
            why: 'Fallback prompt',
          },
          {
            text: 'What is the best piece of advice someone ever gave you?',
            category: 'wisdom',
            why: 'Fallback prompt',
          },
          {
            text: 'Describe a family tradition you hope will continue for generations.',
            category: 'tradition',
            why: 'Fallback prompt',
          },
        ],
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }
});
