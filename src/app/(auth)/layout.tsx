import BrandPanel from '@/components/auth/BrandPanel';
import MobileAuthBar from '@/components/auth/MobileAuthBar';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col auth-lg:flex-row">
      <MobileAuthBar />
      <BrandPanel />
      <div className="form-island flex flex-1 items-center justify-center bg-form-bg px-brand py-[26px] pb-8 text-form-fg auth-sm:px-11 auth-sm:pt-10 auth-sm:pb-12 auth-lg:p-11">
        <div className="w-full max-w-brand-form auth-sm:max-w-brand-form-wide auth-lg:max-w-brand-form">
          {children}
        </div>
      </div>
    </div>
  );
}
