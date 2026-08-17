import { SplashScreen } from '@/components/splash/SplashScreen';

// Every visitor gets the splash and onboarding now. Desktop used to be redirected
// straight to /studio and so never saw either — it was gated by its own modal
// instead, a second sign-in surface with none of the onboarding around it. That
// modal is deleted; there is one sign-in surface for every viewport.
export default function Home() {
  return <SplashScreen />;
}
