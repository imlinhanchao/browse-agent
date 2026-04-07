import { defineConfig, presetUno, presetIcons } from 'unocss';

export default defineConfig({
  presets: [
    presetUno(),
    presetIcons({
      scale: 1.2,
      warn: true,
    }),
  ],
  theme: {
    colors: {
      bg: '#0f1117',
      surface: '#1a1d27',
      surface2: '#11111b',
      border: '#2a2e3a',
      text: '#e1e4eb',
      muted: '#8b8fa3',
      accent: '#6c8cff',
      'accent-hover': '#5a7aee',
      success: '#4ade80',
      error: '#f87171',
      warning: '#fbbf24',
    },
  },
});
