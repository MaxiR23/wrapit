// tests/lib/boardAccess.test.ts
//
// Tests for board-access labels, capability helpers, and the public URL.
//
// Tested:
// - canEditBoard is true only for EDIT
// - canCommentOnBoard is true for EDIT and COMMENT
// - canAdministerProject is true for OWNER and ADMIN
// - Access and owner labels are English and shared
// - publicBoardUrl is origin plus the project path
//
// What is covered:
// - Derived display and capability helpers
//
// Run with: pnpm test:run tests/lib/boardAccess.test.ts
//
// SEE: src/lib/boardAccess.ts

import { describe, it, expect } from 'vitest';

import {
  BOARD_ACCESS_OPTIONS,
  boardAccessLabel,
  canAdministerProject,
  canCommentOnBoard,
  canEditBoard,
  publicBoardUrl,
  shareMemberControlLabel,
} from '@/lib/boardAccess';

describe('board access helpers', () => {
  it('treats only EDIT as editable', () => {
    expect(canEditBoard('EDIT')).toBe(true);
    expect(canEditBoard('COMMENT')).toBe(false);
    expect(canEditBoard('VIEW')).toBe(false);
  });

  it('treats EDIT and COMMENT as able to comment', () => {
    expect(canCommentOnBoard('EDIT')).toBe(true);
    expect(canCommentOnBoard('COMMENT')).toBe(true);
    expect(canCommentOnBoard('VIEW')).toBe(false);
  });

  it('treats OWNER and ADMIN as team admins', () => {
    expect(canAdministerProject('OWNER')).toBe(true);
    expect(canAdministerProject('ADMIN')).toBe(true);
    expect(canAdministerProject('MEMBER')).toBe(false);
  });

  it('labels access levels and the owner row from one source', () => {
    expect(boardAccessLabel('EDIT')).toBe('Can edit');
    expect(boardAccessLabel('COMMENT')).toBe('Can comment');
    expect(boardAccessLabel('VIEW')).toBe('View only');
    expect(shareMemberControlLabel({ role: 'OWNER', access: 'EDIT' })).toBe('Owner');
    expect(shareMemberControlLabel({ role: 'ADMIN', access: 'EDIT' })).toBe('Can edit');
    expect(BOARD_ACCESS_OPTIONS.map((option) => option.value)).toEqual(['EDIT', 'COMMENT', 'VIEW']);
  });

  it('derives the public URL from origin and the project path', () => {
    expect(publicBoardUrl('https://wrapit.example', 'project-1')).toBe(
      'https://wrapit.example/projects/project-1',
    );
  });
});
