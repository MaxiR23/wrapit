import type { AccountTab } from '@/lib/routes';

const COPY: Record<Exclude<AccountTab, 'profile'>, string> = {
  visibility: 'Visibility is coming soon.',
  activity: 'Activity is coming soon.',
  cards: 'Cards is coming soon.',
};

export default function AccountTabPlaceholder({ tab }: { tab: Exclude<AccountTab, 'profile'> }) {
  return (
    <div
      id={`account-panel-${tab}`}
      role="tabpanel"
      aria-labelledby={`account-tab-${tab}`}
      className="px-7 py-6 pb-[34px] text-[13.5px] text-muted-foreground"
    >
      {COPY[tab]}
    </div>
  );
}
