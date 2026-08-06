export type UserTier = 'free' | 'creator' | 'pro';

export type FeatureKey =
  | 'enhance_clean'
  | 'enhance_hd'
  | 'waveform_circle'
  | 'waveform_spectrogram'
  | 'font_poppins'
  | 'font_montserrat'
  | 'font_space_grotesk'
  | 'font_dm_sans'
  | 'font_playfair'
  | 'format_vertical'
  | 'format_horizontal'
  | 'format_instagram'
  | 'layout_flipped'
  | 'unlimited_exports'
  | 'background_video'
  | 'background_upload'
  | 'director_reroll';

const TIER_RANK: Record<UserTier, number> = {
  free: 0,
  creator: 1,
  pro: 2,
};

/**
 * What a tier unlocks.
 *
 * The rule: **gate what costs us money, give away what does not.**
 *
 * Fonts, waveform shapes, aspect ratios and layouts are drawn on the user's own
 * device. They cost us nothing per use and are infinite in supply, so locking
 * them bought no margin and cost conversions — they are exactly the things that
 * make someone think "this is good" before they have paid anything. They are
 * free now.
 *
 * What remains gated all has a bill behind it: GPU seconds for enhancement,
 * Convex storage for uploaded backgrounds, OpenAI calls for Director rerolls.
 * Transcription is not here at all — it is metered in credits instead, which is
 * a better fit for a per-minute cost than a yes/no gate.
 *
 * The other paid lever is the export watermark, which is not a feature gate at
 * all: see `StudioExportBody`, where it keys off `tier === 'free'`. It costs us
 * nothing to remove and is the most common reason people upgrade, which makes
 * it the ideal thing to charge for.
 */
export const FEATURE_GATES: Record<FeatureKey, UserTier> = {
  // ── Costs us money per use ───────────────────────────────────────────────
  enhance_clean: 'creator', // Modal A10G seconds
  enhance_hd: 'creator', // Modal A10G seconds, and also priced in credits
  background_video: 'creator', // Convex storage + egress
  background_upload: 'creator', // Convex storage
  director_reroll: 'creator', // an extra OpenAI completion per reroll

  // ── Free: rendered on the user's device, costs us nothing ────────────────
  waveform_circle: 'free',
  waveform_spectrogram: 'free',
  font_poppins: 'free',
  font_montserrat: 'free',
  font_space_grotesk: 'free',
  font_dm_sans: 'free',
  font_playfair: 'free',
  format_vertical: 'free',
  format_horizontal: 'free',
  format_instagram: 'free',
  layout_flipped: 'free',
  // Encoding happens in the browser, so an export costs us nothing. The daily
  // cap it used to enforce is replaced by the credit balance, which meters the
  // transcription that precedes the export rather than the export itself.
  unlimited_exports: 'free',
};

export function tierHasAccess(userTier: UserTier, required: UserTier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[required];
}
