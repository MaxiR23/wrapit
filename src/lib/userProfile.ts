import { prisma } from '@/lib/prisma';

export const PROFILE_VISIBILITY_VALUES = ['anyone', 'team', 'admins'] as const;

export type ProfileVisibility = (typeof PROFILE_VISIBILITY_VALUES)[number];

export const PROFILE_VALUE_FIELDS = [
  'fullName',
  'publicName',
  'pronouns',
  'jobTitle',
  'department',
  'organization',
  'location',
  'workingWithYou',
] as const;

export type ProfileValueField = (typeof PROFILE_VALUE_FIELDS)[number];

export const PROFILE_VISIBILITY_FIELDS = [
  'photo',
  'fullName',
  'publicName',
  'pronouns',
  'jobTitle',
  'department',
  'organization',
  'location',
  'localTime',
  'workingWithYou',
  'email',
] as const;

export type ProfileVisibilityField = (typeof PROFILE_VISIBILITY_FIELDS)[number];

export type UserProfileView = {
  name: string;
  username: string;
  email: string;
  fullName: string;
  pronouns: string;
  jobTitle: string;
  department: string;
  organization: string;
  location: string;
  workingWithYou: string;
  visibilities: Record<ProfileVisibilityField, ProfileVisibility>;
};

const DEFAULT_VISIBILITIES: Record<ProfileVisibilityField, ProfileVisibility> = {
  photo: 'anyone',
  fullName: 'anyone',
  publicName: 'anyone',
  pronouns: 'anyone',
  jobTitle: 'anyone',
  department: 'anyone',
  organization: 'anyone',
  location: 'anyone',
  localTime: 'anyone',
  workingWithYou: 'anyone',
  email: 'admins',
};

type ProfileRow = {
  fullName?: unknown;
  pronouns?: unknown;
  jobTitle?: unknown;
  department?: unknown;
  organization?: unknown;
  location?: unknown;
  workingWithYou?: unknown;
  photoVisibility?: unknown;
  fullNameVisibility?: unknown;
  publicNameVisibility?: unknown;
  pronounsVisibility?: unknown;
  jobTitleVisibility?: unknown;
  departmentVisibility?: unknown;
  organizationVisibility?: unknown;
  locationVisibility?: unknown;
  localTimeVisibility?: unknown;
  workingWithYouVisibility?: unknown;
  emailVisibility?: unknown;
};

type UserRow = {
  name?: unknown;
  username?: unknown;
  email?: unknown;
};

/** Maps a Prisma ProfileVisibility (or anything else) to the UI value. Unknown → anyone. */
export function parseProfileVisibility(value: unknown): ProfileVisibility {
  if (value === 'TEAM') return 'team';
  if (value === 'ADMINS_ONLY') return 'admins';
  return 'anyone';
}

export function toPrismaProfileVisibility(
  visibility: ProfileVisibility,
): 'ANYONE' | 'TEAM' | 'ADMINS_ONLY' {
  if (visibility === 'team') return 'TEAM';
  if (visibility === 'admins') return 'ADMINS_ONLY';
  return 'ANYONE';
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function visibilitiesFromRow(
  row: ProfileRow | null,
): Record<ProfileVisibilityField, ProfileVisibility> {
  if (!row) return { ...DEFAULT_VISIBILITIES };

  return {
    photo: parseProfileVisibility(row.photoVisibility),
    fullName: parseProfileVisibility(row.fullNameVisibility),
    publicName: parseProfileVisibility(row.publicNameVisibility),
    pronouns: parseProfileVisibility(row.pronounsVisibility),
    jobTitle: parseProfileVisibility(row.jobTitleVisibility),
    department: parseProfileVisibility(row.departmentVisibility),
    organization: parseProfileVisibility(row.organizationVisibility),
    location: parseProfileVisibility(row.locationVisibility),
    localTime: parseProfileVisibility(row.localTimeVisibility),
    workingWithYou: parseProfileVisibility(row.workingWithYouVisibility),
    email: row.emailVisibility == null ? 'admins' : parseProfileVisibility(row.emailVisibility),
  };
}

export function profileFromUserAndRow(user: UserRow, row: ProfileRow | null): UserProfileView {
  const name = asString(user.name);
  const username = asString(user.username);

  return {
    name,
    username,
    email: asString(user.email),
    fullName: asString(row?.fullName),
    pronouns: asString(row?.pronouns),
    jobTitle: asString(row?.jobTitle),
    department: asString(row?.department),
    organization: asString(row?.organization),
    location: asString(row?.location),
    workingWithYou: asString(row?.workingWithYou),
    visibilities: visibilitiesFromRow(row),
  };
}

const VALUE_COLUMNS = {
  fullName: 'fullName',
  pronouns: 'pronouns',
  jobTitle: 'jobTitle',
  department: 'department',
  organization: 'organization',
  location: 'location',
  workingWithYou: 'workingWithYou',
} as const;

export function profileValueColumn(
  field: Exclude<ProfileValueField, 'publicName'>,
): (typeof VALUE_COLUMNS)[keyof typeof VALUE_COLUMNS] {
  return VALUE_COLUMNS[field];
}

const VISIBILITY_COLUMNS: Record<ProfileVisibilityField, string> = {
  photo: 'photoVisibility',
  fullName: 'fullNameVisibility',
  publicName: 'publicNameVisibility',
  pronouns: 'pronounsVisibility',
  jobTitle: 'jobTitleVisibility',
  department: 'departmentVisibility',
  organization: 'organizationVisibility',
  location: 'locationVisibility',
  localTime: 'localTimeVisibility',
  workingWithYou: 'workingWithYouVisibility',
  email: 'emailVisibility',
};

export function profileVisibilityColumn(field: ProfileVisibilityField): string {
  return VISIBILITY_COLUMNS[field];
}

/** Stored profile for the user, or empty defaults when no row exists yet. */
export async function getUserProfileForUser(userId: string): Promise<UserProfileView | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const row = await prisma.userProfile.findUnique({ where: { userId } });
  return profileFromUserAndRow(user, row);
}
