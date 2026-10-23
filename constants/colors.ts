export const COLORS = {
  primary: '#C8874A',          // caramel
  background: '#1C120D',       // dark espresso
  card: '#2A1B14',             // roasted brown
  textPrimary: '#F5E9DA',      // cream
  textSecondary: '#D2BBA0',    // latte foam
  textOnPrimary: '#2B1A12',    // dark espresso text on caramel buttons
  surface: '#33231A',          // mocha
  border: '#4A3428',           // cocoa
  shadow: '#000000',
  warning: '#E9B44C',          // honey
  success: '#8FB573',          // matcha
  danger: '#C0483A',           // cherry brick
  accent: '#D9A066',           // light latte
  magenta: '#C97B63',          // rosy terracotta
  cardBorderNeon: '#C8874A33', // soft caramel glow
  muted: '#9C8573',            // warm gray-brown

  // Glass tokens
  glass: 'rgba(255, 244, 230, 0.10)',          // frosted fill
  glassStrong: 'rgba(255, 244, 230, 0.18)',    // buttons, pressed states
  glassBorder: 'rgba(255, 244, 230, 0.22)',    // thin light edge
  glassHighlight: 'rgba(255, 255, 255, 0.35)', // top-edge shine
  glassTint: 'rgba(200, 135, 74, 0.12)',       // caramel tint

  // Screen background gradient (glass needs something behind it to blur)
  bgGradient: ['#1C120D', '#3A2418', '#5A3924'],
} as const;