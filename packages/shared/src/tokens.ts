/**
 * Design tokens to ensure consistency across the app.
 */

export const COLORS = {
  primary: '#3b82f6', // Blue 500
  secondary: '#10b981', // Emerald 500
  background: '#0f172a', // Slate 900
  text: '#f8fafc', // Slate 50
  error: '#ef4444', // Red 500
} as const;

export const FONTS = {
  inter: 'Inter',
  roboto: 'Roboto',
  outfit: 'Outfit',
} as const;

export const RESOLUTIONS = {
  square: { width: 1080, height: 1080, label: 'Square (1:1)' },
  portrait: { width: 1080, height: 1920, label: 'Portrait (9:16)' },
  landscape: { width: 1920, height: 1080, label: 'Landscape (16:9)' },
} as const;
