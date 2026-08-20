'use client';

import AccountProfile from '@/components/account/AccountProfile';
import AccountTabPlaceholder from '@/components/account/AccountTabPlaceholder';
import AccountTabs from '@/components/account/AccountTabs';
import { useDisplayName } from '@/components/account/DisplayNameProvider';
import type { AccountTab } from '@/lib/routes';
import type { UserProfileView } from '@/lib/userProfile';

export default function AccountScreen({
  tab,
  profile,
}: {
  tab: AccountTab;
  profile: UserProfileView;
}) {
  const { name, initials } = useDisplayName(profile.name, profile.username);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="projects-content-wash flex shrink-0 flex-col gap-4 px-7 pt-[26px]">
        <div className="flex items-center gap-3.5">
          <span
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border-strong bg-card text-sm font-semibold leading-none"
            aria-hidden="true"
          >
            {initials}
          </span>
          <div className="mr-auto flex min-w-0 flex-col gap-[3px]">
            <h1 className="text-2xl font-semibold tracking-[-0.02em]">{name}</h1>
            <span className="text-[13px] text-muted-foreground">@{profile.username}</span>
          </div>
        </div>
        <AccountTabs tab={tab} />
      </header>
      <div className="min-h-0 flex-1 overflow-auto">
        {tab === 'profile' ? (
          <AccountProfile profile={profile} />
        ) : (
          <AccountTabPlaceholder tab={tab} />
        )}
      </div>
    </div>
  );
}
