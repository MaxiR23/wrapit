'use client';

import { useActiveStatus } from '@/components/account/ActiveStatusProvider';
import { userStatusToneClasses } from '@/lib/userStatus';
import { cn } from '@/lib/utils';

export default function AccountStatusPill() {
  const { status } = useActiveStatus();
  if (!status.name) return null;

  const tone = userStatusToneClasses(status.color);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        tone.pill,
      )}
    >
      {status.name}
    </span>
  );
}
