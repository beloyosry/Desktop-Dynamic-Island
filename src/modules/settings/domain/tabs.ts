export const TABS = [
  { id: 'media', label: 'Music', feature: 'tabMedia' },
  { id: 'apps', label: 'Apps', feature: 'tabApps' },
  { id: 'shelf', label: 'Shelf', feature: 'tabShelf' },
  { id: 'tools', label: 'Tools', feature: 'tabTools' },
  { id: 'notes', label: 'Notes', feature: 'tabNotes' },
  { id: 'prayer', label: 'Prayer', feature: 'tabPrayer' },
  { id: 'quran', label: 'Quran', feature: 'tabQuran' },
  { id: 'timer', label: 'Timer', feature: 'tabTimer' },
  { id: 'system', label: 'System', feature: 'tabSystem' },
  { id: 'toolkit', label: 'Toolkit', feature: 'tabToolkit' },
] as const;
export const tabOrder = (value: string) => [
  ...new Set([
    ...value.split(',').filter((id) => TABS.some((tab) => tab.id === id)),
    ...TABS.map((tab) => tab.id),
  ]),
];
