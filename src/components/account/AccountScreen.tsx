'use client';

import ScreenHeader from '@/components/ScreenHeader';
import AccountActivity from '@/components/account/AccountActivity';
import AccountProfile from '@/components/account/AccountProfile';
import AccountStatusPill from '@/components/account/AccountStatusPill';
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
        <ScreenHeader
          inset="pane"
          leading={
            <span
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border-strong bg-card text-sm font-semibold leading-none"
              aria-hidden="true"
            >
              {initials}
            </span>
          }
          title={name}
          subtitle={
            <div className="flex items-center gap-[9px]">
              <span>@{profile.username}</span>
              <AccountStatusPill />
            </div>
          }
        >
          <AccountTabs tab={tab} />
        </ScreenHeader>
        <div className="min-h-0 overflow-auto tablet:flex-1">
          {tab === 'profile' ? (
            <AccountProfile profile={profile} />
          ) : tab === 'visibility' ? (
            <AccountVisibility statuses={statuses} username={profile.username} />
          ) : (
            <AccountActivity
              projects={activity?.projects ?? []}
              initialItems={activity?.items ?? []}
              initialCursor={activity?.nextCursor ?? null}
            />
          )}
        </div>
      </div>
    </ActiveStatusProvider>
  );
}
