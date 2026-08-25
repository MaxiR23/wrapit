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

export function publicBoardUrl(origin: string, projectId: string): string {
  return `${origin}${projectPath(projectId)}`;
}
