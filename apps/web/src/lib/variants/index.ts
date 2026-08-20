/**
 * Ordio's design tokens, split by concern.
 *
 * One system, used by both the mobile and desktop implementations — ADR 0001
 * keeps those implementations separate but explicitly does NOT split the Style
 * system along the same line.
 *
 * Colour never appears here as a literal. Values resolve through the `--acid-*`
 * layer in globals.css; the desktop editor's `--ord-*` names are aliases onto
 * that same layer, defined in ord-tokens.css.
 *
 * The `acid*` and `ord*` prefixes are historical — they record which design
 * pass a variant arrived in, not which system it belongs to. Dropping them
 * would mean choosing a winner between `heading` and `acidHeading`, which
 * render differently, so that is a visual decision, not a mechanical one.
 */

export * from './typography';
export * from './prose';
export * from './buttons';
export * from './capture';
export * from './surfaces';
export * from './controls';
export * from './brand';
