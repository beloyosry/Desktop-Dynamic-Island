export const THEMES = [
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Ink & starlight',
    base: '#101522',
    accent: '#8ab4ff',
    secondary: '#b7a0ff',
  },
  {
    id: 'cyber',
    name: 'Cyber',
    description: 'Electric blue & pink',
    base: '#101629',
    accent: '#52e5ff',
    secondary: '#f28bde',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Jade & northern lights',
    base: '#10251f',
    accent: '#60e5af',
    secondary: '#94a8ff',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Apricot & warm coral',
    base: '#2b1820',
    accent: '#ffb184',
    secondary: '#ff7ea6',
  },
  {
    id: 'glacier',
    name: 'Glacier',
    description: 'Ice blue & silver',
    base: '#192b3d',
    accent: '#a0e1ff',
    secondary: '#d2caff',
  },
  {
    id: 'rose',
    name: 'Rose',
    description: 'Blush & raspberry',
    base: '#2c1526',
    accent: '#ff9ac7',
    secondary: '#ffc793',
  },
  {
    id: 'violet',
    name: 'Nebula',
    description: 'Lilac & ultraviolet',
    base: '#221834',
    accent: '#c5a1ff',
    secondary: '#86c9ff',
  },
  {
    id: 'lagoon',
    name: 'Lagoon',
    description: 'Turquoise & sea glass',
    base: '#10272f',
    accent: '#6de3df',
    secondary: '#a3c6ff',
  },
] as const;

export const MOTION_PRESETS = ['auto', 'expressive', 'reduced'] as const;
export const themeById = (id: string | undefined) => THEMES.find((theme) => theme.id === id) ?? THEMES[0];
