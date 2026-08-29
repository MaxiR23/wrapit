export default function AuthFormIsland({
  children,
  id,
}: {
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <div
      id={id}
      className="form-island flex flex-1 items-center justify-center bg-form-bg px-brand py-[26px] pb-8 text-form-fg max-auth-sm:min-h-screen max-auth-sm:min-h-svh max-auth-sm:pt-[calc(var(--spacing-auth-bar)+26px)] auth-sm:px-11 auth-sm:pt-10 auth-sm:pb-12 auth-lg:p-11"
    >
      <div className="w-full max-w-brand-form auth-sm:max-w-brand-form-wide auth-lg:max-w-brand-form">
        {children}
      </div>
    </div>
  );
}
