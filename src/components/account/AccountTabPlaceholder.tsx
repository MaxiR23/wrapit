export default function AccountTabPlaceholder({ tab }: { tab: 'cards' }) {
  return (
    <div
      id={`account-panel-${tab}`}
      role="tabpanel"
      aria-labelledby={`account-tab-${tab}`}
      className="px-7 py-6 pb-[34px] text-[13.5px] text-muted-foreground"
    >
      Cards is coming soon.
    </div>
  );
}
