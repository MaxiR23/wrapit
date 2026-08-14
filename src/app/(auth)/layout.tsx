import AuthFormIsland from '@/components/auth/AuthFormIsland';
import BrandPanel from '@/components/auth/BrandPanel';
import MobileAuthBar from '@/components/auth/MobileAuthBar';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col auth-lg:flex-row">
      <MobileAuthBar />
      <BrandPanel />
      <AuthFormIsland>{children}</AuthFormIsland>
    </div>
  );
}
