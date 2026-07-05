/**
 * Accent color palettes. Each is a full 50–900 ramp (hex). The active accent is
 * applied as CSS variables (`--brand-50` … `--brand-900`) so the entire UI —
 * everything that uses Tailwind's `brand-*` — recolors instantly.
 */
export type AccentKey = 'blue' | 'purple' | 'emerald' | 'orange' | 'red' | 'pink';

export const ACCENTS: Record<AccentKey, { label: string; ramp: Record<string, string>; swatch: string }> = {
  blue: {
    label: 'Blue',
    swatch: '#2563eb',
    ramp: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a' },
  },
  purple: {
    label: 'Purple',
    swatch: '#8b5cf6',
    ramp: { 50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95' },
  },
  emerald: {
    label: 'Emerald',
    swatch: '#10b981',
    ramp: { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b' },
  },
  orange: {
    label: 'Orange',
    swatch: '#f97316',
    ramp: { 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12' },
  },
  red: {
    label: 'Red',
    swatch: '#f43f5e',
    ramp: { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337' },
  },
  pink: {
    label: 'Pink',
    swatch: '#ec4899',
    ramp: { 50: '#fdf2f8', 100: '#fce7f3', 200: '#fbcfe8', 300: '#f9a8d4', 400: '#f472b6', 500: '#ec4899', 600: '#db2777', 700: '#be185d', 800: '#9d174d', 900: '#831843' },
  },
};

/** "#3479ff" -> "52 121 255" (space-separated RGB for `rgb(var(--x) / <alpha>)`). */
export function hexToRgbTriplet(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export function applyAccent(key: AccentKey) {
  const ramp = ACCENTS[key].ramp;
  const root = document.documentElement;
  for (const [shade, hex] of Object.entries(ramp)) {
    root.style.setProperty(`--brand-${shade}`, hexToRgbTriplet(hex));
  }
}
