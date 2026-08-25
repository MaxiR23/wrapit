'use client';

import AccountActivity from '@/components/account/AccountActivity';
import AccountProfile from '@/components/account/AccountProfile';
import AccountStatusPill from '@/components/account/AccountStatusPill';
import AccountTabPlaceholder from '@/components/account/AccountTabPlaceholder';
import AccountTabs from '@/components/account/AccountTabs';
import AccountVisibility from '@/components/account/AccountVisibility';
import { ActiveStatusProvider } from '@/components/account/ActiveStatusProvider';
import { useDisplayName } from '@/components/account/DisplayNameProvider';
import type { AccountActivityView } from '@/lib/accountActivity';
import type { AccountTab } from '@/lib/routes';
import type { UserProfileView } from '@/lib/userProfile';
import { parseUserStatusTone, type UserStatusesView } from '@/lib/userStatus';

export default function AccountScreen({
  tab,
  profile,
  statuses,
  activity,
}: {
  tab: AccountTab;
  profile: UserProfileView;
  statuses: UserStatusesView;
  activity?: AccountActivityView;
}) {
  const { name, initials } = useDisplayName(profile.name, profile.username);
  const active =
    statuses.statuses.find((status) => status.id === statuses.activeStatusId) ??
    statuses.statuses[0];

  return (
    <ActiveStatusProvider
      initial={{
        id: active?.id ?? '',
        name: active?.name ?? '',
        color: parseUserStatusTone(active?.color),
      }}
    >
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
              <div className="flex items-center gap-[9px]">
                <span className="text-[13px] text-muted-foreground">@{profile.username}</span>
                <AccountStatusPill />
              </div>
            </div>
          </div>
          <AccountTabs tab={tab} />
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          {tab === 'profile' ? (
            <AccountProfile profile={profile} />
          ) : tab === 'visibility' ? (
            <AccountVisibility statuses={statuses} username={profile.username} />
          ) : tab === 'activity' ? (
            <AccountActivity
              projects={activity?.projects ?? []}
              initialItems={activity?.items ?? []}
              initialCursor={activity?.nextCursor ?? null}
            />
          ) : (
            <AccountTabPlaceholder tab="cards" />
          )}
        </div>
      </div>
    </ActiveStatusProvider>
  );
}
