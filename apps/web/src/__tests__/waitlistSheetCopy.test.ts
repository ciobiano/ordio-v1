import { describe, it, expect } from 'vitest';
import { copyFor } from '@/components/mobile/modals/WaitlistSheet';

/**
 * The waitlist sheet is where every ceiling in the product terminates. These
 * guard the distinction that matters: a *limit* is not a *failure*, and must
 * not read like one.
 *
 * Since the checkout routes were removed there is a second thing to guard —
 * the copy must not promise a purchase that cannot be made. "Upgrade" and
 * "Creator" are the words that would reintroduce that lie, so they are asserted
 * absent rather than merely edited out.
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
    // is the difference between "I lost my take" and "I hit a limit".
    expect(copyFor('transcription_credits').body.toLowerCase()).toContain('safe');
  });

  it('never exposes credits as a unit — users are shown minutes', () => {
    const { title, body } = copyFor('transcription_credits');
    const text = `${title} ${body}`.toLowerCase();

    expect(text).not.toContain('credit balance');
    expect(text).toContain('minutes');
  });

  it.each(['transcription_credits', 'export_limit', 'enhance_hd'] as const)(
    'never offers a purchase that does not exist, for %s',
    (target) => {
      const { title, body } = copyFor(target);
      const text = `${title} ${body}`.toLowerCase();

      expect(text).not.toContain('upgrade');
      expect(text).not.toContain('creator');
      expect(text).not.toContain('/mo');
    }
  );

  it('asks for an email instead, since that is the only action available', () => {
    expect(copyFor('transcription_credits').body.toLowerCase()).toContain('email');
  });

  it('still handles the export limit', () => {
    expect(copyFor('export_limit').title).toBe('Daily export limit reached');
  });

  it('falls back to the export limit when no target is given', () => {
    // Older call sites passed undefined to mean "export limit".
    expect(copyFor(undefined)).toEqual(copyFor('export_limit'));
  });

  it('names the feature when an unavailable control was tapped', () => {
    expect(copyFor('enhance_hd').title).toBe('HD Remaster is not available yet');
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
