import Link from 'next/link';

import {
  authFooterClassName,
  authFooterLinkClassName,
  authFormClassName,
  authFormErrorBandClassName,
  authFormHeaderClassName,
  authFormSubtitleClassName,
  authFormTitleClassName,
} from '@/components/auth/formClasses';
import { EMAIL_ALREADY_VERIFIED_MESSAGE, VERIFICATION_LINK_INVALID_MESSAGE } from '@/lib/messages';
import { CHECK_EMAIL_PATH, SIGN_IN_PATH } from '@/lib/routes';

type VerifyEmailResultProps = {
  error?: string;
};

export default function VerifyEmailResult({ error }: VerifyEmailResultProps) {
  if (error) {
    return (
      <div className={authFormClassName}>
        <p role="alert" className={authFormErrorBandClassName}>
          {VERIFICATION_LINK_INVALID_MESSAGE}
        </p>
        <p className={authFooterClassName}>
          <Link href={CHECK_EMAIL_PATH} className={authFooterLinkClassName}>
            Request a new link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className={authFormClassName}>
      <div className={authFormHeaderClassName}>
        <h1 className={authFormTitleClassName}>Email already verified</h1>
        <p className={authFormSubtitleClassName}>{EMAIL_ALREADY_VERIFIED_MESSAGE}</p>
      </div>
      <p className={authFooterClassName}>
        <Link href={SIGN_IN_PATH} className={authFooterLinkClassName}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
