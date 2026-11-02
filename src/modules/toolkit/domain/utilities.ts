export const UNIT_GROUPS = {
  length: {
    label: 'Length',
    units: {
      m: ['Metres', 1],
      km: ['Kilometres', 1000],
      cm: ['Centimetres', 0.01],
      in: ['Inches', 0.0254],
      ft: ['Feet', 0.3048],
      mi: ['Miles', 1609.344],
    },
  },
  mass: {
    label: 'Weight',
    units: {
      kg: ['Kilograms', 1],
      g: ['Grams', 0.001],
      lb: ['Pounds', 0.45359237],
      oz: ['Ounces', 0.028349523125],
    },
  },
  temperature: {
    label: 'Temperature',
    units: { c: ['Celsius', 1, 0], f: ['Fahrenheit', 5 / 9, (-32 * 5) / 9], k: ['Kelvin', 1, -273.15] },
  },
  data: {
    label: 'Data',
    units: {
      b: ['Bytes', 1],
      kb: ['KB (1000 B)', 1000],
      mb: ['MB', 1000000],
      gb: ['GB', 1000000000],
      mib: ['MiB (1024² B)', 1048576],
      gib: ['GiB', 1073741824],
    },
  },
  time: {
    label: 'Time',
    units: { s: ['Seconds', 1], min: ['Minutes', 60], h: ['Hours', 3600], d: ['Days', 86400] },
  },
  speed: {
    label: 'Speed',
    units: {
      ms: ['Metres / second', 1],
      kmh: ['Kilometres / hour', 1 / 3.6],
      mph: ['Miles / hour', 0.44704],
      kn: ['Knots', 1852 / 3600],
    },
  },
  area: {
    label: 'Area',
    units: {
      m2: ['Square metres', 1],
      ft2: ['Square feet', 0.09290304],
      ha: ['Hectares', 10000],
      ac: ['Acres', 4046.8564224],
    },
  },
  volume: {
    label: 'Volume',
    units: {
      l: ['Litres', 1],
      ml: ['Millilitres', 0.001],
      gal: ['US gallons', 3.785411784],
      cup: ['US cups', 0.2365882365],
    },
  },
} satisfies Record<string, { label: string; units: Record<string, readonly [string, number, number?]> }>;
export type UnitGroup = keyof typeof UNIT_GROUPS;
export function convertUnit(value: number, group: UnitGroup, from: string, to: string) {
  if (!Number.isFinite(value) || !Object.hasOwn(UNIT_GROUPS, group)) throw new Error('Enter a valid number.');
  const units: Record<string, readonly [string, number, number?]> = UNIT_GROUPS[group].units;
  if (!Object.hasOwn(units, from) || !Object.hasOwn(units, to)) throw new Error('Choose two units.');
  const result = (value * units[from][1] + (units[from][2] || 0) - (units[to][2] || 0)) / units[to][1];
  if (!Number.isFinite(result)) throw new Error('This value is too large to convert.');
  return result;
}
export const TEXT_ACTIONS = {
  upper: 'UPPERCASE',
  lower: 'lowercase',
  title: 'Title Case',
  trim: 'Clean spaces',
  unique: 'Unique lines',
  sort: 'Sort lines',
  encode: 'Base64 encode',
  decode: 'Base64 decode',
  urlEncode: 'URL encode',
  urlDecode: 'URL decode',
} as const;
export function transformText(text: string, action: keyof typeof TEXT_ACTIONS) {
  const limit = action === 'decode' || action === 'urlDecode' ? 200000 : 20000;
  if (text.length > limit) throw new Error('Keep source text under 20,000 characters.');
  switch (action) {
    case 'upper':
      return text.toLocaleUpperCase();
    case 'lower':
      return text.toLocaleLowerCase();
    case 'title':
      return text.toLocaleLowerCase().replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase());
    case 'trim':
      return text
        .split('\n')
        .map((line) => line.trim().replace(/[\t ]+/g, ' '))
        .join('\n')
        .trim();
    case 'unique':
      return [...new Set(text.split(/\r?\n/))].join('\n');
    case 'sort':
      return text
        .split(/\r?\n/)
        .sort((a, b) => a.localeCompare(b))
        .join('\n');
    case 'encode':
      return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
    case 'decode':
      return new TextDecoder('utf-8', { fatal: true }).decode(
        Uint8Array.from(atob(text.trim()), (char) => char.charCodeAt(0)),
      );
    case 'urlEncode':
      return encodeURIComponent(text);
    case 'urlDecode':
      return decodeURIComponent(text);
  }
}
export function generatePassword(
  length: number,
  symbols: boolean,
  random = (size: number) => crypto.getRandomValues(new Uint8Array(size)),
) {
  if (!Number.isInteger(length) || length < 12 || length > 64) throw new Error('Choose 12–64 characters.');
  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789' + (symbols ? '!@#$%&*+-_?' : '');
  const ceiling = 256 - (256 % alphabet.length);
  let result = '';
  while (result.length < length) {
    for (const value of random(length * 2)) {
      if (value < ceiling && result.length < length) result += alphabet[value % alphabet.length];
    }
  }
  return result;
}
