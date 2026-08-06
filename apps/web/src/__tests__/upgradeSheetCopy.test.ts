import { describe, it, expect } from 'vitest';
import { copyFor } from '@/components/soul/modals/UpgradeSheet';

/**
 * The upgrade sheet is the only sanctioned place to ask for money. These guard
 * the distinction that matters: a *limit* is not a *failure*, and must not read
 * like one.
 */
describe('copyFor', () => {
  it('treats running out of credits as a pause, never a failure', () => {
    const { title, body } = copyFor('transcription_credits');
    const text = `${title} ${body}`.toLowerCase();

    expect(text).not.toContain('failed');
    expect(text).not.toContain('error');
    expect(text).not.toContain('wrong');
  });

  it('reassures that the recording survived', () => {
    // The audio is still in the store — only transcription stopped. Saying so
    // is the difference between "I lost my take" and "I need to upgrade".
    expect(copyFor('transcription_credits').body.toLowerCase()).toContain('safe');
  });

  it('never exposes credits as a unit — users are shown minutes', () => {
    const { title, body } = copyFor('transcription_credits');
    const text = `${title} ${body}`.toLowerCase();

    expect(text).not.toContain('credit balance');
    expect(text).toContain('minutes');
  });

  it('still handles the export limit', () => {
    expect(copyFor('export_limit').title).toBe('Daily export limit reached');
  });

  it('falls back to the export limit when no target is given', () => {
    // Older call sites passed undefined to mean "export limit".
    expect(copyFor(undefined)).toEqual(copyFor('export_limit'));
  });

  it('names the feature when a locked control was tapped', () => {
    expect(copyFor('enhance_hd').title).toBe('HD Remaster is a Creator feature');
  });

  it.each(['transcription_credits', 'export_limit', 'enhance_hd'] as const)(
    'always produces non-empty copy for %s',
    (target) => {
      const { title, body } = copyFor(target);
      expect(title.trim().length).toBeGreaterThan(0);
      expect(body.trim().length).toBeGreaterThan(0);
      // Trailing whitespace shows up as a ragged gap before the button.
      expect(title).toBe(title.trim());
      expect(body).toBe(body.trim());
    }
  );
});
