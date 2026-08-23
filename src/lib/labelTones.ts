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

const TONE_CLASSES: Record<LabelTone, { text: string; pill: string; swatch: string }> = {
  blue: {
    text: 'text-label-blue',
    pill: 'text-label-blue bg-label-blue/16 border-label-blue/38',
    swatch: 'bg-label-blue/30 border-label-blue',
  },
  green: {
    text: 'text-label-green',
    pill: 'text-label-green bg-label-green/16 border-label-green/38',
    swatch: 'bg-label-green/30 border-label-green',
  },
  amber: {
    text: 'text-label-amber',
    pill: 'text-label-amber bg-label-amber/16 border-label-amber/38',
    swatch: 'bg-label-amber/30 border-label-amber',
  },
  red: {
    text: 'text-label-red',
    pill: 'text-label-red bg-label-red/16 border-label-red/38',
    swatch: 'bg-label-red/30 border-label-red',
  },
  violet: {
    text: 'text-label-violet',
    pill: 'text-label-violet bg-label-violet/16 border-label-violet/38',
    swatch: 'bg-label-violet/30 border-label-violet',
  },
  cyan: {
    text: 'text-label-cyan',
    pill: 'text-label-cyan bg-label-cyan/16 border-label-cyan/38',
    swatch: 'bg-label-cyan/30 border-label-cyan',
  },
  pink: {
    text: 'text-label-pink',
    pill: 'text-label-pink bg-label-pink/16 border-label-pink/38',
    swatch: 'bg-label-pink/30 border-label-pink',
  },
  gray: {
    text: 'text-label-gray',
    pill: 'text-label-gray bg-label-gray/16 border-label-gray/38',
    swatch: 'bg-label-gray/30 border-label-gray',
  },
};

/** Maps a stored tone to a palette key. Unknown → null (do not render a pill). */
export function parseLabelTone(value: unknown): LabelTone | null {
  if (typeof value === 'string' && (LABEL_TONES as readonly string[]).includes(value)) {
    return value as LabelTone;
  }
  return null;
}

export function nextLabelTone(current: LabelTone): LabelTone {
  const index = LABEL_TONES.indexOf(current);
  const from = index < 0 ? 0 : index + 1;
  return LABEL_TONES[from % LABEL_TONES.length]!;
}

export function labelToneForIndex(index: number): LabelTone {
  const length = LABEL_TONES.length;
  const normalized = ((index % length) + length) % length;
  return LABEL_TONES[normalized]!;
}

export function labelToneClasses(tone: LabelTone): (typeof TONE_CLASSES)[LabelTone] {
  return TONE_CLASSES[tone];
}
