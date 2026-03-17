import { FAQAccordion } from './FAQAccordion'

const FAQ_ITEMS = [
  {
    q: 'Is Ordio free to use?',
    a: 'Yes. The core tool is completely free — no account required. Create audiograms, add AI captions, and export MP4 videos at no cost. Pro plans unlock extra styles, watermark removal, and HD audio enhancement.',
  },
  {
    q: 'What audio formats does Ordio support?',
    a: 'MP3, WAV, M4A, and OGG. You can also record directly in the browser — no file upload needed.',
  },
  {
    q: 'How accurate is the AI transcription?',
    a: "Ordio uses OpenAI Whisper for word-level transcription. Accuracy is typically 95%+ for clear English audio. Every word is editable inline before you export.",
  },
  {
    q: 'Does Ordio store my audio or video?',
    a: 'No. All rendering happens in your browser. Audio sent for transcription is processed and immediately discarded — nothing is stored on our servers.',
  },
  {
    q: 'What aspect ratios and resolutions are supported?',
    a: '16:9 landscape (YouTube, LinkedIn), 9:16 vertical (Reels, Shorts, TikTok), and 1:1 square (Twitter, Instagram). All formats export at 1080p.',
  },
  {
    q: 'Do I need to create an account?',
    a: 'No account is needed to use the free tier. Sign up only if you want to save projects, access Pro styles, or remove the Ordio watermark.',
  },
]

export function LandingFAQ() {
  return (
    <section className="relative z-[1] max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 lg:gap-15 items-start px-4 sm:px-8 lg:px-30 py-12 sm:py-20 pb-16 sm:pb-24">
      {/* Vertical divider line — desktop only */}
      <div className="hidden lg:block absolute left-[463px] top-0 -bottom-16 w-px bg-white/10 pointer-events-none" />

      {/* Left column — heading */}
      <div className="pt-1.5">
        <h2 className="text-[length:var(--text-h2)] font-normal tracking-[-0.5px] leading-[var(--leading-heading)] text-white/90">
          Frequently<br />asked<br />questions.
        </h2>
      </div>

      {/* Right column — accordion */}
      <FAQAccordion items={FAQ_ITEMS} />
    </section>
  )
}
