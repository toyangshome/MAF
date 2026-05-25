export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  colors: {
    background: string;
    surface: string;
    surfaceHover: string;
    border: string;
    text: string;
    textMuted: string;
    accent: string;
    accentMuted: string;
    success: string;
    warning: string;
    error: string;
    info: string;
  };
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'dark',
    name: 'Dark',
    description: 'Default dark theme',
    colors: {
      background: '#11111b',
      surface: '#1e1e2e',
      surfaceHover: '#282840',
      border: '#313244',
      text: '#cdd6f4',
      textMuted: '#6c7086',
      accent: '#89b4fa',
      accentMuted: '#45475a',
      success: '#a6e3a1',
      warning: '#f9e2af',
      error: '#f38ba8',
      info: '#89dceb',
    },
  },
  {
    id: 'light',
    name: 'Light',
    description: 'Clean light theme',
    colors: {
      background: '#ffffff',
      surface: '#f5f5f7',
      surfaceHover: '#ebebed',
      border: '#d2d2d7',
      text: '#1d1d1f',
      textMuted: '#86868b',
      accent: '#0071e3',
      accentMuted: '#e8f0fe',
      success: '#34c759',
      warning: '#ff9f0a',
      error: '#ff3b30',
      info: '#5ac8fa',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight Blue',
    description: 'Deep blue dark theme',
    colors: {
      background: '#0a0e1a',
      surface: '#121829',
      surfaceHover: '#1c2438',
      border: '#252d44',
      text: '#b8c5e0',
      textMuted: '#5a6580',
      accent: '#5b8af5',
      accentMuted: '#1e2d4a',
      success: '#4ade80',
      warning: '#fbbf24',
      error: '#f87171',
      info: '#38bdf8',
    },
  },
  {
    id: 'solarized',
    name: 'Solarized',
    description: 'Solarized dark theme',
    colors: {
      background: '#002b36',
      surface: '#073642',
      surfaceHover: '#0a4050',
      border: '#586e75',
      text: '#839496',
      textMuted: '#657b83',
      accent: '#268bd2',
      accentMuted: '#0e3a4a',
      success: '#859900',
      warning: '#b58900',
      error: '#dc322f',
      info: '#2aa198',
    },
  },
];
