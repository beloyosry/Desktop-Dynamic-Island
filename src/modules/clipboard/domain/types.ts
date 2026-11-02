export type SmartClip =
  | { type: 'url'; url: string; host: string }
  | { type: 'color'; color: string }
  | { type: 'math'; expr: string; result: string }
  | { type: 'text'; words: number; chars: number };
