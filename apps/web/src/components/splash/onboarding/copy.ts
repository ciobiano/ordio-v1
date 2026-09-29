/**
 * Onboarding copy, one entry per slide. Phone and desk share it so the two
 * can never tell different stories; the only difference is the device named
 * in the last line, because the export really does run on the device in hand.
 */
export interface OnboardingSlide {
  head: string;
  accent: string;
  /** Break before the accent word on phones, where the headline wraps anyway. */
  breakBeforeAccent: boolean;
  sub: (device: 'phone' | 'computer') => string;
}

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    head: 'Turn voice notes into',
    accent: 'videos',
    breakBeforeAccent: false,
    sub: () => 'Record once. Ordio times every word and styles the captions for you.',
  },
  {
    head: 'Every word,',
    accent: 'on time',
    breakBeforeAccent: true,
    sub: (device) =>
      `Captions light up the moment you say them. ${device === 'phone' ? 'Tap' : 'Click'} any word to fix it.`,
  },
  {
    head: 'Pick a look,',
    accent: 'post anywhere',
    breakBeforeAccent: true,
    sub: (device) => `Reframe for TikTok, Reels or Shorts and export an MP4 made on your ${device}.`,
  },
];
