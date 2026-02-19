/**
 * Katha Typography
 * 
 * Display: Playfair Display (serif, character, warmth)
 * Body: Source Sans 3 (clean, readable, supports many scripts)
 * 
 * Load these via expo-font in _layout.tsx
 */

export const fontFamily = {
  // Serif — for headings, capsule titles, quotes
  serif: 'PlayfairDisplay-Regular',
  serifMedium: 'PlayfairDisplay-Medium',
  serifBold: 'PlayfairDisplay-Bold',
  serifItalic: 'PlayfairDisplay-Italic',

  // Sans — for body, UI, navigation
  sans: 'SourceSans3-Regular',
  sansMedium: 'SourceSans3-Medium',
  sansSemiBold: 'SourceSans3-SemiBold',
  sansBold: 'SourceSans3-Bold',
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
} as const;

export const lineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const;

// Pre-composed text styles
export const textStyles = {
  // Display — hero text, big moments
  displayLarge: {
    fontFamily: fontFamily.serifBold,
    fontSize: fontSize['5xl'],
    lineHeight: fontSize['5xl'] * lineHeight.tight,
  },
  displayMedium: {
    fontFamily: fontFamily.serifBold,
    fontSize: fontSize['4xl'],
    lineHeight: fontSize['4xl'] * lineHeight.tight,
  },

  // Headings
  h1: {
    fontFamily: fontFamily.serifBold,
    fontSize: fontSize['3xl'],
    lineHeight: fontSize['3xl'] * lineHeight.tight,
  },
  h2: {
    fontFamily: fontFamily.serifMedium,
    fontSize: fontSize['2xl'],
    lineHeight: fontSize['2xl'] * lineHeight.tight,
  },
  h3: {
    fontFamily: fontFamily.serifMedium,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl * lineHeight.normal,
  },

  // Body
  bodyLarge: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.lg,
    lineHeight: fontSize.lg * lineHeight.relaxed,
  },
  body: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * lineHeight.relaxed,
  },
  bodySmall: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.normal,
  },

  // Special
  quote: {
    fontFamily: fontFamily.serifItalic,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl * lineHeight.relaxed,
  },
  caption: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * lineHeight.normal,
  },
  label: {
    fontFamily: fontFamily.sansSemiBold,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.normal,
    letterSpacing: 0.5,
  },
  button: {
    fontFamily: fontFamily.sansSemiBold,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * lineHeight.normal,
  },
} as const;
