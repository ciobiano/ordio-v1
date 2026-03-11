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
  | 'caption_center'
  | 'caption_karaoke'
  | 'unlimited_exports';

const TIER_RANK: Record<UserTier, number> = {
  free: 0,
  creator: 1,
  pro: 2,
};

export const FEATURE_GATES: Record<FeatureKey, UserTier> = {
  enhance_clean: 'creator',
  enhance_hd: 'creator',
  waveform_circle: 'creator',
  waveform_spectrogram: 'creator',
  font_poppins: 'creator',
  font_montserrat: 'creator',
  font_space_grotesk: 'creator',
  font_dm_sans: 'creator',
  font_playfair: 'creator',
  format_vertical: 'creator',
  format_horizontal: 'creator',
  format_instagram: 'creator',
  caption_center: 'creator',
  caption_karaoke: 'creator',
  unlimited_exports: 'creator',
};

export function tierHasAccess(userTier: UserTier, required: UserTier): boolean {
  return TIER_RANK[userTier] >= TIER_RANK[required];
}
