import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, IBM_Plex_Sans, Geist_Mono, Nunito } from 'next/font/google';
import { Toaster } from 'sonner';
import Providers from '@/components/Providers';
import './globals.css';
import { cn } from "@/lib/utils";

const geistMonoHeading = Geist_Mono({subsets:['latin'],variable:'--font-heading'});

const ibmPlexSans = IBM_Plex_Sans({subsets:['latin'],variable:'--font-sans'});

// Local fonts are now loaded from the public fonts folder via CSS only

const plusJakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700'],
  display: 'swap',
});

// Acid system display + body — Duolingo's own brand guidelines name Nunito
// as their substitute font (see DESIGN.md). Replaces self-hosted Clash
// Grotesk + Satoshi.
const nunitoAcid = Nunito({
  variable: '--font-acid-nunito',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ordio.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Ordio — Audio to Video',
  description:
    'Create beautiful waveform videos from your audio. Free, instant, no sign-up required.',
  keywords: [
    'audiogram',
    'waveform video',
    'audio to video',
    'podcast clip',
    'social media video',
    'audio visualizer',
  ],
  openGraph: {
    title: 'Ordio — Audio to Video',
    description:
      'Create beautiful waveform videos from your audio. Free, instant, no sign-up required.',
    url: siteUrl,
    siteName: 'Ordio',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ordio — Audio to Video',
    description:
      'Create beautiful waveform videos from your audio. Free, instant, no sign-up required.',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: siteUrl,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={cn("dark font-sans", ibmPlexSans.variable, geistMonoHeading.variable, nunitoAcid.variable)}>
      <body className={`${plusJakarta.variable} antialiased`}>
        <a href="#main-content" className="skip-nav">Skip to main content</a>
        <Providers>{children}</Providers>
        <Toaster theme="dark" position="bottom-center" />
      </body>
    </html>
  );
}
