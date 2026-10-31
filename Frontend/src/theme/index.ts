// Design tokens for Office Attendance — single source of truth.
// All screens import from here; never hardcode colors or spacing inline.

export const Colors = {
  // Backgrounds
  bgPrimary: '#E9DFC9',
  bgSurface: '#F8F0DE',
  bgSurfaceRaised: '#FFF9ED',

  // Text
  textPrimary: '#423528',
  textSecondary: '#82735E',
  textDisabled: '#A99F8C',
  textInverse: '#FFFFFF',

  // Accent / brand
  accent: '#315C43',
  accentLight: '#E0E8D8',
  accentPressed: '#1E402D',

  // Status — semantic
  success: '#315C43',
  successBg: '#E0E8D8',
  successBorder: '#B5C5A8',

  warning: '#93651F',
  warningBg: '#F0E2BE',
  warningBorder: '#D5BD83',

  error: '#963D32',
  errorBg: '#F1DFD5',
  errorBorder: '#D3B3A5',

  info: '#356B7A',
  infoBg: '#D9E8E7',
  infoBorder: '#A7C9C8',

  // Neutral
  border: '#C5B18D',
  borderFocus: '#315C43',
  divider: '#E8DCC5',

  // Status badges
  present: '#315C43',
  presentBg: '#E0E8D8',
  late: '#93651F',
  lateBg: '#F0E2BE',
  absent: '#963D32',
  absentBg: '#F1DFD5',

  // Avatar palette (cycled by index)
  avatarPalette: [
    '#315C43', '#356B7A', '#52785B', '#93651F',
    '#963D32', '#6C527E', '#7B5C75', '#4D7181',
  ],

  // Overlay / glass
  overlayLight: 'rgba(255,255,255,0.72)',
  overlayDark: 'rgba(66,53,40,0.48)',
} as const;

export const Typography = {
  // Font sizes
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,

  // Font weights (React Native uses string literals)
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,

  // Line heights
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.7,
} as const;

export const Spacing = {
  // 4-point scale
  px: 1,
  '0.5': 2,
  '1': 4,
  '1.5': 6,
  '2': 8,
  '2.5': 10,
  '3': 12,
  '4': 16,
  '5': 20,
  '6': 24,
  '7': 28,
  '8': 32,
  '10': 40,
  '12': 48,
  '16': 64,
} as const;

export const Radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

export const Shadows = {
  none: {},
  xs: {
    shadowColor: '#796448',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  sm: {
    shadowColor: '#796448',
    shadowOffset: { width: 2, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#796448',
    shadowOffset: { width: 3, height: 5 },
    shadowOpacity: 0.19,
    shadowRadius: 6,
    elevation: 5,
  },
  lg: {
    shadowColor: '#796448',
    shadowOffset: { width: 5, height: 7 },
    shadowOpacity: 0.22,
    shadowRadius: 9,
    elevation: 7,
  },
  accent: {
    shadowColor: '#1E402D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
} as const;

export const Sizes = {
  inputHeight: 52,
  buttonHeight: 52,
  buttonHeightSm: 40,
  headerHeight: 60,
  avatarSm: 36,
  avatarMd: 48,
  avatarLg: 56,
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
  touchMin: 44,
} as const;
