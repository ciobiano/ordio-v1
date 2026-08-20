// apps/web/src/app/create/page.tsx
//
// The single capture route for every viewport. It chooses which chrome to mount
// and nothing else — the mobile and desktop bodies each own their own flow hook.
//
// This replaced a hard user-agent route split (`/create` for phones, `/studio`
// for desktops, with redirects in middleware and on `/`). That split let desktop
// drift months behind mobile in silence: the two routes shared no components, so
// no mobile change ever broke a desktop build or failed a desktop test. One route
// with one auth gate means the next mobile improvement reaches both by default
// instead of by somebody remembering.
//
// Only one branch mounts. Rendering both and hiding one with CSS would run two
// canvas RAF loops, two audio analysers and two microphone streams at once.
'use client';

import dynamic from 'next/dynamic';

import { useIsDesktopViewport } from '@/hooks/useBreakpoint';

const MobileCaptureFlow = dynamic(
  () =>
    import('@/components/mobile/capture/MobileCaptureFlow').then(
      (m) => m.MobileCaptureFlow
    ),
  { ssr: false }
);

// The desktop editor, rebuilt from the "Ordio Desktop Editor" design export.
// It replaces StudioDesk at desktop widths; StudioDesk itself is now unused by
// this route and can go once the editor reaches parity on export.
const DeskShell = dynamic(
  () => import('@/components/desktop/DeskShell').then((m) => m.DeskShell),
  { ssr: false }
);

export default function CreatePage() {
  const isDesktop = useIsDesktopViewport();

  return (
    <main id="main-content" className="relative min-h-dvh">
      {isDesktop ? <DeskShell /> : <MobileCaptureFlow />}
    </main>
  );
}
