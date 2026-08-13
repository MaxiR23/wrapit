export const authFormClassName = 'flex w-full flex-col gap-4 auth-sm:gap-[var(--spacing-form-gap)]';

export const authFormHeaderClassName = 'flex flex-col gap-1.5';

export const authFormTitleClassName =
  'text-[22px] font-semibold tracking-[-0.02em] auth-sm:text-2xl';

export const authFormSubtitleClassName = 'text-sm text-form-muted';

export const authFormErrorBandClassName =
  'rounded-md border border-form-danger-border bg-form-danger-bg px-[13px] py-[11px] text-form-meta text-form-danger-fg';

export const authFormSuccessBandClassName =
  'rounded-md border border-form-line bg-form-success-bg px-[13px] py-[11px] text-form-meta text-form-fg';

export const authFieldClassName = 'gap-[7px] data-[invalid=true]:text-form-fg';

export const authFieldLabelClassName = 'text-[13.5px] font-medium text-form-fg auth-lg:text-[13px]';

export const authFieldGroupClassName = 'gap-[var(--spacing-form-gap)]';

export const authInputClassName =
  'h-[var(--spacing-form-field)] rounded-md border-form-input-border bg-form-input-bg px-3.5 text-base text-form-fg shadow-none outline-none placeholder:text-form-muted focus-visible:border-form-input-border focus-visible:ring-0 disabled:bg-form-input-bg aria-invalid:border-form-danger-fg aria-invalid:ring-0 dark:bg-form-input-bg dark:text-form-fg dark:disabled:bg-form-input-bg auth-sm:h-11 auth-sm:px-[13px] auth-sm:text-[15px] auth-lg:h-[var(--spacing-form-control)] auth-lg:px-3 auth-lg:text-sm';

export const authButtonClassName =
  'h-12 w-full gap-2 rounded-md border-transparent bg-form-fg text-[15px] font-medium text-form-bg hover:bg-form-cta-hover focus-visible:ring-0 disabled:opacity-100 dark:bg-form-fg dark:text-form-bg dark:hover:bg-form-cta-hover auth-sm:h-[var(--spacing-form-field)] auth-lg:h-[var(--spacing-form-control)] auth-lg:text-sm';

export const authFieldErrorClassName = 'text-form-hint font-normal text-form-danger-fg';

export const authFooterClassName = 'text-center text-form-meta text-form-muted auth-sm:text-left';

export const authFooterLinkClassName = 'font-medium text-form-fg underline underline-offset-[3px]';

export const authForgotLinkDesktopClassName =
  'hidden text-form-hint text-form-muted underline underline-offset-[3px] auth-sm:inline';

export const authForgotLinkMobileClassName =
  'min-h-11 self-center text-center text-form-meta text-form-muted underline underline-offset-[3px] auth-sm:hidden';
