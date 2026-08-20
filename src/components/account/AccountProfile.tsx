'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { updateProfileField } from '@/actions/updateProfileField';
import { updateProfileVisibility } from '@/actions/updateProfileVisibility';
import { useDisplayName } from '@/components/account/DisplayNameProvider';
import ProfileFieldRow, { profileInputClassName } from '@/components/account/ProfileFieldRow';
import {
  PROFILE_AUTOSAVE_DEBOUNCE_MS,
  useProfileAutosave,
} from '@/components/account/useProfileAutosave';
import VisibilityDropdown from '@/components/account/VisibilityDropdown';
import { VisibilityMenuProvider } from '@/components/account/VisibilityMenuProvider';
import { formatLocalTime } from '@/lib/localTime';
import type {
  ProfileValueField,
  ProfileVisibility,
  ProfileVisibilityField,
  UserProfileView,
} from '@/lib/userProfile';

function useFieldValue(field: ProfileValueField, initial: string) {
  return useProfileAutosave({
    initial,
    debounceMs: PROFILE_AUTOSAVE_DEBOUNCE_MS,
    save: (value) => updateProfileField({ field, value }),
  });
}

function useFieldVisibility(field: ProfileVisibilityField, initial: ProfileVisibility) {
  return useProfileAutosave({
    initial,
    debounceMs: 0,
    save: (visibility) => updateProfileVisibility({ field, visibility }),
  });
}

function LocalTimeValue() {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    function tick() {
      setLabel(formatLocalTime(new Date(), timeZone));
    }
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <p className="flex h-[34px] items-center text-[13.5px] text-muted-foreground tabular-nums">
      {label}
    </p>
  );
}

function FieldSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <span className="mr-auto text-[13px] font-semibold text-foreground">{title}</span>
        <span className="text-[11.5px] text-subtle">Who can see this?</span>
      </div>
      <div className="flex flex-col rounded-lg border border-border bg-surface">{children}</div>
    </div>
  );
}

export default function AccountProfile({ profile }: { profile: UserProfileView }) {
  const { setName, initials } = useDisplayName(profile.name, profile.username);
  const publicName = useProfileAutosave({
    initial: profile.name,
    save: (value) => updateProfileField({ field: 'publicName', value }),
    onSuccess: (value) => setName(value),
    onRevert: (value) => setName(value),
  });
  const fullName = useFieldValue('fullName', profile.fullName);
  const pronouns = useFieldValue('pronouns', profile.pronouns);
  const jobTitle = useFieldValue('jobTitle', profile.jobTitle);
  const department = useFieldValue('department', profile.department);
  const organization = useFieldValue('organization', profile.organization);
  const location = useFieldValue('location', profile.location);
  const workingWithYou = useFieldValue('workingWithYou', profile.workingWithYou);

  const photoVis = useFieldVisibility('photo', profile.visibilities.photo);
  const fullNameVis = useFieldVisibility('fullName', profile.visibilities.fullName);
  const publicNameVis = useFieldVisibility('publicName', profile.visibilities.publicName);
  const pronounsVis = useFieldVisibility('pronouns', profile.visibilities.pronouns);
  const jobTitleVis = useFieldVisibility('jobTitle', profile.visibilities.jobTitle);
  const departmentVis = useFieldVisibility('department', profile.visibilities.department);
  const organizationVis = useFieldVisibility('organization', profile.visibilities.organization);
  const locationVis = useFieldVisibility('location', profile.visibilities.location);
  const localTimeVis = useFieldVisibility('localTime', profile.visibilities.localTime);
  const workingWithYouVis = useFieldVisibility(
    'workingWithYou',
    profile.visibilities.workingWithYou,
  );
  const emailVis = useFieldVisibility('email', profile.visibilities.email);

  return (
    <VisibilityMenuProvider>
      <div
        id="account-panel-profile"
        role="tabpanel"
        aria-labelledby="account-tab-profile"
        className="flex flex-col gap-[26px] px-7 py-6 pb-[34px]"
      >
        <div className="flex items-center gap-4 rounded-lg border border-border bg-surface p-[18px]">
          <span
            className="inline-flex size-14 shrink-0 items-center justify-center rounded-full border border-border-strong bg-muted text-[17px] font-semibold leading-none"
            aria-hidden="true"
          >
            {initials}
          </span>
          <span className="mr-auto text-[13.5px] font-medium text-foreground">
            Who can see your profile photo?
          </span>
          <VisibilityDropdown
            menuKey="photo"
            label="Profile photo"
            value={photoVis.value}
            onChange={photoVis.setValue}
          />
        </div>
        {photoVis.error ? (
          <p role="alert" className="-mt-4 text-xs text-destructive">
            {photoVis.error}
          </p>
        ) : null}

        <FieldSection title="About you">
          <ProfileFieldRow
            label="Full name"
            htmlFor="profile-fullName"
            visibilityKey="fullName"
            visibility={fullNameVis.value}
            onVisibilityChange={fullNameVis.setValue}
            error={fullName.error ?? fullNameVis.error}
          >
            <input
              id="profile-fullName"
              className={profileInputClassName}
              value={fullName.value}
              onChange={(event) => fullName.setValue(event.target.value)}
              onBlur={() => void fullName.flush()}
              placeholder="Your full name"
            />
          </ProfileFieldRow>
          <ProfileFieldRow
            label="Public name"
            htmlFor="profile-publicName"
            visibilityKey="publicName"
            visibility={publicNameVis.value}
            onVisibilityChange={publicNameVis.setValue}
            error={publicName.error ?? publicNameVis.error}
          >
            <input
              id="profile-publicName"
              className={profileInputClassName}
              value={publicName.value}
              onChange={(event) => {
                publicName.setValue(event.target.value);
                setName(event.target.value);
              }}
              onBlur={() => void publicName.flush()}
            />
          </ProfileFieldRow>
          <ProfileFieldRow
            label="Pronouns"
            htmlFor="profile-pronouns"
            visibilityKey="pronouns"
            visibility={pronounsVis.value}
            onVisibilityChange={pronounsVis.setValue}
            error={pronouns.error ?? pronounsVis.error}
          >
            <input
              id="profile-pronouns"
              className={profileInputClassName}
              value={pronouns.value}
              onChange={(event) => pronouns.setValue(event.target.value)}
              onBlur={() => void pronouns.flush()}
              placeholder="Add pronouns"
            />
          </ProfileFieldRow>
          <ProfileFieldRow
            label="Job title"
            htmlFor="profile-jobTitle"
            visibilityKey="jobTitle"
            visibility={jobTitleVis.value}
            onVisibilityChange={jobTitleVis.setValue}
            error={jobTitle.error ?? jobTitleVis.error}
          >
            <input
              id="profile-jobTitle"
              className={profileInputClassName}
              value={jobTitle.value}
              onChange={(event) => jobTitle.setValue(event.target.value)}
              onBlur={() => void jobTitle.flush()}
              placeholder="Your job title"
            />
          </ProfileFieldRow>
          <ProfileFieldRow
            label="Department"
            htmlFor="profile-department"
            visibilityKey="department"
            visibility={departmentVis.value}
            onVisibilityChange={departmentVis.setValue}
            error={department.error ?? departmentVis.error}
          >
            <input
              id="profile-department"
              className={profileInputClassName}
              value={department.value}
              onChange={(event) => department.setValue(event.target.value)}
              onBlur={() => void department.flush()}
              placeholder="Your department"
            />
          </ProfileFieldRow>
          <ProfileFieldRow
            label="Organization"
            htmlFor="profile-organization"
            visibilityKey="organization"
            visibility={organizationVis.value}
            onVisibilityChange={organizationVis.setValue}
            error={organization.error ?? organizationVis.error}
          >
            <input
              id="profile-organization"
              className={profileInputClassName}
              value={organization.value}
              onChange={(event) => organization.setValue(event.target.value)}
              onBlur={() => void organization.flush()}
              placeholder="Your organization"
            />
          </ProfileFieldRow>
          <ProfileFieldRow
            label="Location"
            htmlFor="profile-location"
            visibilityKey="location"
            visibility={locationVis.value}
            onVisibilityChange={locationVis.setValue}
            error={location.error ?? locationVis.error}
          >
            <input
              id="profile-location"
              className={profileInputClassName}
              value={location.value}
              onChange={(event) => location.setValue(event.target.value)}
              onBlur={() => void location.flush()}
              placeholder="Your location"
            />
          </ProfileFieldRow>
          <ProfileFieldRow
            label="Local time"
            visibilityKey="localTime"
            visibility={localTimeVis.value}
            onVisibilityChange={localTimeVis.setValue}
            error={localTimeVis.error}
          >
            <LocalTimeValue />
          </ProfileFieldRow>
          <ProfileFieldRow
            label="Working with you"
            htmlFor="profile-workingWithYou"
            visibilityKey="workingWithYou"
            visibility={workingWithYouVis.value}
            onVisibilityChange={workingWithYouVis.setValue}
            error={workingWithYou.error ?? workingWithYouVis.error}
            last
          >
            <input
              id="profile-workingWithYou"
              className={profileInputClassName}
              value={workingWithYou.value}
              onChange={(event) => workingWithYou.setValue(event.target.value)}
              onBlur={() => void workingWithYou.flush()}
              placeholder="Tell others when and how to collaborate with you"
            />
          </ProfileFieldRow>
        </FieldSection>

        <FieldSection title="Contact">
          <ProfileFieldRow
            label="Email address"
            htmlFor="profile-email"
            visibilityKey="email"
            visibility={emailVis.value}
            onVisibilityChange={emailVis.setValue}
            error={emailVis.error}
            last
          >
            <input
              id="profile-email"
              className={profileInputClassName}
              value={profile.email}
              readOnly
            />
          </ProfileFieldRow>
        </FieldSection>
      </div>
    </VisibilityMenuProvider>
  );
}
