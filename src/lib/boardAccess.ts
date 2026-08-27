import type { BoardAccess } from '@/lib/membership';
import { projectPath } from '@/lib/routes';

export type MembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export type ShareAccessValue = BoardAccess | 'REMOVED';

export function canEditBoard(access: BoardAccess): boolean {
  return access === 'EDIT';
}

export function canCommentOnBoard(access: BoardAccess): boolean {
  return access === 'EDIT' || access === 'COMMENT';
}

export function canAdministerProject(role: MembershipRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export function boardAccessLabel(access: BoardAccess): string {
  switch (access) {
    case 'EDIT':
      return 'Can edit';
    case 'COMMENT':
      return 'Can comment';
    case 'VIEW':
      return 'View only';
  }
}

export function shareMemberControlLabel(input: {
  role: MembershipRole;
  access: BoardAccess;
}): string {
  if (input.role === 'OWNER') return 'Owner';
  return boardAccessLabel(input.access);
}

export const BOARD_ACCESS_OPTIONS: ReadonlyArray<{ value: BoardAccess; label: string }> = [
  { value: 'EDIT', label: 'Can edit' },
  { value: 'COMMENT', label: 'Can comment' },
  { value: 'VIEW', label: 'View only' },
];

export const REMOVE_ACCESS_LABEL = 'Remove access';

export const TRANSFER_OWNERSHIP_LABEL = 'Transfer ownership';

export const LEAVE_PROJECT_LABEL = 'Leave project';

/** Optimistic and persisted display after ownership moves to `ownerMembershipId`. */
export function membershipsAfterOwnershipTransfer<
  T extends { membershipId: string; role: MembershipRole; access: BoardAccess },
>(members: T[], ownerMembershipId: string): T[] {
  const currentOwner = members.find((member) => member.role === 'OWNER');
  if (!currentOwner || currentOwner.membershipId === ownerMembershipId) {
    return members;
  }
  const target = members.find((member) => member.membershipId === ownerMembershipId);
  if (!target) return members;

  return members.map((member) => {
    if (member.membershipId === ownerMembershipId) {
      return { ...member, role: 'OWNER' as const, access: 'EDIT' as const };
    }
    if (member.membershipId === currentOwner.membershipId) {
      return { ...member, role: 'ADMIN' as const, access: 'EDIT' as const };
    }
    return member;
  });
}

export function publicBoardUrl(origin: string, projectId: string): string {
  return `${origin}${projectPath(projectId)}`;
}
