/**
 * Katha Color Palette — "Warm Heritage Modern"
 * 
 * Inspired by aged parchment, amber resin, terracotta pottery,
 * and the deep teal of vintage book covers.
 */

export const colors = {
  // Primary — warm amber/gold (time capsule, warmth, preservation)
  amber: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
  },

  // Secondary — deep teal (trust, depth, heritage)
  teal: {
    50: '#F0FDFA',
    100: '#CCFBF1',
    200: '#99F6E4',
    300: '#5EEAD4',
    400: '#2DD4BF',
    500: '#14B8A6',
    600: '#0D9488',
    700: '#0F766E',
    800: '#115E59',
    900: '#134E4A',
  },

  // Accent — terracotta (warmth, earthiness, handmade feel)
  terracotta: {
    300: '#F0A590',
    400: '#E07A5F',
    500: '#CD5C45',
    600: '#B84A35',
    700: '#9C3D2B',
  },

  // Warm neutrals — cream to deep brown
  cream: '#FFF8F0',
  parchment: '#F5ECD7',
  warm: {
    50: '#FAF7F4',
    100: '#F5F0EB',
    200: '#E8DFD5',
    300: '#D4C5B5',
    400: '#B8A594',
    500: '#9C8873',
    600: '#7D6B59',
    700: '#6B5B4E',
    800: '#4A3F35',
    900: '#2D2420',
  },

  // Functional
  white: '#FFFFFF',
  black: '#1A1A1A',
  success: '#059669',
  error: '#DC2626',
  warning: '#D97706',

  // Special
  locked: '#8B7355',      // Sealed envelope brown
  waxSeal: '#9B2335',     // Wax seal red
  gold: '#C9A84C',        // Gold foil accents
  inkBlue: '#1E3A5F',     // Ink color for text
} as const;

// Semantic color mapping
export const semantic = {
  background: colors.cream,
  surface: colors.white,
  surfaceAlt: colors.warm[50],
  
  textPrimary: colors.warm[900],
  textSecondary: colors.warm[600],
  textMuted: colors.warm[400],
  textOnDark: colors.cream,
  
  primary: colors.amber[500],
  primaryDark: colors.amber[700],
  primaryLight: colors.amber[100],
  
  secondary: colors.teal[700],
  secondaryLight: colors.teal[100],
  
  accent: colors.terracotta[400],
  
  border: colors.warm[200],
  borderLight: colors.warm[100],
  
  capsuleCard: colors.white,
  lockedCapsule: colors.warm[100],
  
  recording: colors.terracotta[500],
  recordingGlow: 'rgba(224, 122, 95, 0.3)',
} as const;
