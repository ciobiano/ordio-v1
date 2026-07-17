import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { isMobileUserAgent } from '@/lib/deviceDetect';
import { SplashScreen } from '@/components/splash/SplashScreen';

export const dynamic = 'force-dynamic';

// The mobile splash/onboarding screens are mobile-only — desktop visitors
// go straight to /studio, which gates itself with StudioAuthModal.
export default async function Home() {
  const headersList = await headers();
  if (!isMobileUserAgent(headersList.get('user-agent'))) {
    redirect('/studio');
  }
  return <SplashScreen />;
}
