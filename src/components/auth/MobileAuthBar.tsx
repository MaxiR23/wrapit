import { ChevronUp } from 'lucide-react';
import Link from 'next/link';

import BrandMark from '@/components/auth/BrandMark';
import { HOME_PATH } from '@/lib/routes';

export default function MobileAuthBar() {
  return (
    <header className="brand-bar-surface flex items-center gap-3 px-4 py-3.5 auth-sm:hidden">
      <BrandMark />
      <Link
        href={HOME_PATH}
        aria-label="Back"
        className="ml-auto -mr-2 inline-flex size-11 items-center justify-center text-brand-icon hover:text-foreground"
      >
        <ChevronUp size={18} strokeWidth={1.7} />
      </Link>
    </header>
  );
}
