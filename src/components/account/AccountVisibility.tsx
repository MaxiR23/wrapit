'use client';

import UserStatusList from '@/components/account/UserStatusList';
import UserStatusPreview from '@/components/account/UserStatusPreview';
import type { UserStatusesView } from '@/lib/userStatus';

export default function AccountVisibility({
  statuses,
  username,
}: {
  statuses: UserStatusesView;
  username: string;
}) {
  return (
    <div
      id="account-panel-visibility"
      role="tabpanel"
      aria-labelledby="account-tab-visibility"
      className="grid min-w-0 grid-cols-1 gap-[26px] px-7 py-6 pb-[34px] lg:grid-cols-[minmax(0,1fr)_292px]"
    >
      <UserStatusList initialStatuses={statuses.statuses} />
      <UserStatusPreview username={username} />
    </div>
  );
}
