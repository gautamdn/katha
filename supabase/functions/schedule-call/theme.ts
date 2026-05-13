import type { ElderLanguage } from '../_shared/types.ts';

export interface ThemeContext {
  is_first_call: boolean;
  language: ElderLanguage;
  recent_themes: string[];      // themes covered in last N calls
  family_suggested?: string;
  date: Date;                   // current date for festival/season awareness
}

const FIRST_CALL_THEME = 'a gentle introduction — one nice memory from this week';

const THEME_POOL: { theme: string; weight: number }[] = [
  { theme: 'childhood and school days', weight: 1 },
  { theme: 'how you met your spouse', weight: 1 },
  { theme: 'your wedding day', weight: 1 },
  { theme: 'food and recipes from home', weight: 1 },
  { theme: 'a festival or celebration that stays with you', weight: 1 },
  { theme: 'your first job or career', weight: 1 },
  { theme: 'a journey you took as a young person', weight: 1 },
  { theme: 'wisdom you would share with your grandchildren', weight: 1.2 },
  { theme: 'your siblings and growing up together', weight: 1 },
  { theme: 'songs or stories you remember from your childhood', weight: 1 },
  { theme: 'a time you had to be brave', weight: 1 },
  { theme: 'someone who shaped who you are', weight: 1 },
];

export function pickTheme(ctx: ThemeContext): string {
  if (ctx.family_suggested) return ctx.family_suggested;
  if (ctx.is_first_call) return FIRST_CALL_THEME;

  const recent = new Set(ctx.recent_themes.map((t) => t.toLowerCase()));
  const available = THEME_POOL.filter((t) => !recent.has(t.theme.toLowerCase()));
  const pool = available.length > 0 ? available : THEME_POOL;

  // weighted random
  const totalWeight = pool.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * totalWeight;
  for (const t of pool) {
    r -= t.weight;
    if (r <= 0) return t.theme;
  }
  return pool[0].theme;
}
