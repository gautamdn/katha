import { assertEquals, assertNotEquals } from 'jsr:@std/assert@1';
import { pickTheme } from './theme.ts';

Deno.test('first call returns the gentle intro theme', () => {
  const result = pickTheme({
    is_first_call: true,
    language: 'kn',
    recent_themes: [],
    date: new Date(),
  });
  assertEquals(result.includes('gentle'), true);
});

Deno.test('family-suggested theme overrides automatic', () => {
  const result = pickTheme({
    is_first_call: false,
    language: 'kn',
    recent_themes: [],
    family_suggested: 'tell me about Bhuj before partition',
    date: new Date(),
  });
  assertEquals(result, 'tell me about Bhuj before partition');
});

Deno.test('avoids recently-covered themes', () => {
  const recent = ['childhood and school days', 'your wedding day'];
  // run many times; none of the picks should be from the recent list
  for (let i = 0; i < 50; i++) {
    const t = pickTheme({
      is_first_call: false,
      language: 'kn',
      recent_themes: recent,
      date: new Date(),
    });
    assertEquals(recent.includes(t.toLowerCase()), false);
  }
});
