import AuthFormIsland from '@/components/auth/AuthFormIsland';
import BrandPanel from '@/components/auth/BrandPanel';
import LandingHero from '@/components/auth/LandingHero';
import MobileAuthBar from '@/components/auth/MobileAuthBar';

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col auth-lg:flex-row">
      <div id="landing-hero" className="auth-sm:hidden">
        <LandingHero />
      </div>
      <MobileAuthBar href="#landing-hero" />
      <BrandPanel />
      <AuthFormIsland id="sign-in-form">{children}</AuthFormIsland>
    </div>
  );
}
