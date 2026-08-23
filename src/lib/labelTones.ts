export const LABEL_TONES = [
  'blue',
  'green',
  'amber',
  'red',
  'violet',
  'cyan',
  'pink',
  'gray',
] as const;

export type LabelTone = (typeof LABEL_TONES)[number];

const TONE_CLASSES: Record<LabelTone, { text: string; pill: string }> = {
  blue: {
    text: 'text-label-blue',
    pill: 'text-label-blue bg-label-blue/16 border-label-blue/38',
  },
  green: {
    text: 'text-label-green',
    pill: 'text-label-green bg-label-green/16 border-label-green/38',
  },
  amber: {
    text: 'text-label-amber',
    pill: 'text-label-amber bg-label-amber/16 border-label-amber/38',
  },
  red: {
    text: 'text-label-red',
    pill: 'text-label-red bg-label-red/16 border-label-red/38',
  },
  violet: {
    text: 'text-label-violet',
    pill: 'text-label-violet bg-label-violet/16 border-label-violet/38',
  },
  cyan: {
    text: 'text-label-cyan',
    pill: 'text-label-cyan bg-label-cyan/16 border-label-cyan/38',
  },
  pink: {
    text: 'text-label-pink',
    pill: 'text-label-pink bg-label-pink/16 border-label-pink/38',
  },
  gray: {
    text: 'text-label-gray',
    pill: 'text-label-gray bg-label-gray/16 border-label-gray/38',
  },
};

/** Maps a stored tone to a palette key. Unknown → null (do not render a pill). */
export function parseLabelTone(value: unknown): LabelTone | null {
  if (typeof value === 'string' && (LABEL_TONES as readonly string[]).includes(value)) {
    return value as LabelTone;
  }
  return null;
}

export function labelToneClasses(tone: LabelTone): (typeof TONE_CLASSES)[LabelTone] {
  return TONE_CLASSES[tone];
}
