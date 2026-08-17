/**
 * The feature gate contract, shared by the UI and the Convex backend.
 *
 * This lives in @Ordio/shared for the same reason the credit arithmetic does:
 * both sides have to agree. When the table lived only in `apps/web`, Convex
 * could not import it, so `backgrounds.uploadBackground` carried its own
 * hand-written copy of the rule — and when the free pivot flipped the client
 * table to `free`, the server copy kept throwing. The UI showed an unlocked
 * upload button that failed on the last step of the upload, after the file had
 * already been stored.
 *
 * A duplicated rule is a rule that will drift. There is now one table, and
 * every gate — client or server — is `tierHasAccess(tier, FEATURE_GATES[key])`.
 */

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
 * What a tier unlocks — currently, everything.
 *
 * There is nothing to buy. The checkout routes are gone, so no account can ever
 * hold a tier above `free`, and a gate left at `creator` would be a permanently
 * shut door rather than a prompt to upgrade. A lock with no key on sale is
 * indistinguishable from a broken feature.
 *
 * The spend ceiling moved wholesale to the credit ledger, which is the better
 * instrument regardless: it meters the thing that actually costs money, by the
 * minute, instead of guessing which features correlate with cost. Enhancement
 * and Director rerolls were gated because they burn GPU seconds and completions
 * — those are now bounded by the same finite balance as everything else.
 *
 * The table is kept rather than deleted because it is the seam a paid tier
 * would come back through, and `tierHasAccess` still guards every call site.
 * Flipping one entry back to `creator` is the entire change.
 */
export const FEATURE_GATES: Record<FeatureKey, UserTier> = {
  // ── Bounded by the credit ledger rather than by tier ─────────────────────
  enhance_clean: 'free',
  enhance_hd: 'free',
  background_video: 'free',
  background_upload: 'free',
  director_reroll: 'free',

  // ── Rendered on the user's device, costs us nothing ──────────────────────
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
