export const DEFAULTS = {
  // expanded tabs
  tabMedia: true,
  tabApps: true,
  tabShelf: true,
  tabTools: true,
  tabNotes: true,
  tabPrayer: true,
  tabQuran: true,
  tabTimer: true,
  tabSystem: true,
  tabToolkit: true,
  boostMode: false,
  panelWidth: 660,
  panelHeight: 350,
  cornerRadius: 40,
  glassOpacity: 48,
  customAccent: '',
  hoverExpand: true,
  hoverDelay: 280,
  clock24: false,
  clockSeconds: false,
  defaultTab: 'media',
  tabOrder: 'media,apps,shelf,tools,notes,prayer,quran,timer,system,toolkit',
  visualDensity: 'comfortable',
  soundEffects: true,
  wheelVolume: true,
  themePreset: 'midnight',
  motionPreset: 'expressive',
  colorGlow: true,
  liquidReflections: true,
  reduceTransparency: false,
  // idle pill slides
  slideClock: true,
  slideStats: true,
  slidePrayer: true,
  // live activities
  mediaPill: true,
  mediaTitle: true,
  trackPeek: true,
  // notifications
  notificationTray: true,
  notificationDrop: true,
  kbdToast: true,
  capsToast: true,
  hudVolume: true,
  hudBrightness: true,
  battery: true,
  prayerAlerts: true,
  asrHanafi: false, // Asr by the Hanafi shadow rule
  hijriAdjust: 0, // days added to the Hijri date (local moon sighting)
  // IDM Nova
  downloads: true,
  dlToasts: true,
  folderDownloads: true, // browser downloads, seen in the download folders
  // window
  hideFullscreen: true,
  autoUpdate: true, // download new versions from GitHub and offer a restart on the island
  addrIsland: true, // take the right third of the browser's address bar
  // System tab
  clipboardHistory: true,
  // copied image / screenshot -> toast; on the Shelf by itself for a while, or "Add to Shelf"
  screenshotToast: true,
  shotAutoShelf: true,
  shotShelfMinutes: 20,
  // mic / camera in use
  privacyDots: true,
  // companion
  netToasts: true,
  welcomeBack: true,
  morningBrief: true,
  wellbeing: true,
  smartClipboard: true,
  novaEyes: true,
  novaPrayer: true, // Nova in her prayer cap at the adhan
  novaFocus: true, // Nova with her headband at focus start / end
  water: true, // the Drop reminds you to drink
  waterEvery: 60, // minutes at the computer between glasses
  waterGoal: 8, // glasses a day (~2 L)
  celebrate: true,
  // upcoming meetings (iCal link in calendar.json)
  meetings: true,
  // reminders: dhikr, du'a, Qur'an
  reminders: true,
  remindAyah: true,
  remindDhikr: true,
  remindDua: true,
  remindEvery: 5, // minutes
  remindFor: 30, // seconds on screen
  // quiet hours for reminders (minutes after midnight; may wrap past midnight)
  quietHours: false,
  quietFrom: 23 * 60,
  quietTo: 7 * 60,
  // focus sessions (Pomodoro)
  focusMin: 25,
  breakMin: 5,
  longBreakMin: 15,
};

// number settings and their allowed range
export const RANGES: Partial<Record<keyof Features, readonly [number, number]>> = {
  panelWidth: [600, 700],
  panelHeight: [330, 390],
  cornerRadius: [20, 48],
  glassOpacity: [25, 95],
  hoverDelay: [150, 1200],
  remindEvery: [1, 240],
  remindFor: [5, 300],
  quietFrom: [0, 1439],
  quietTo: [0, 1439],
  focusMin: [5, 120],
  breakMin: [1, 60],
  longBreakMin: [5, 60],
  hijriAdjust: [-2, 2],
  waterEvery: [15, 240],
  waterGoal: [4, 16],
  shotShelfMinutes: [5, 1440],
};

export type Features = typeof DEFAULTS;
export type FeatureKey = keyof Features;
