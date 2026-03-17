import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { Toaster } from 'sonner';
import Providers from '@/components/Providers';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  variable: '--font-jakarta',
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700'],
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
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className={`${plusJakarta.variable} antialiased`}>
        <a href="#main-content" className="skip-nav">Skip to main content</a>
        <Providers>{children}</Providers>
        <Toaster theme="dark" position="bottom-center" />
      </body>
    </html>
  );
}
