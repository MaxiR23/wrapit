import type { LabelTone } from '@/lib/labelTones';

export type BoardMember = {
  id: string;
  name: string;
  username: string;
};

export type ShareMember = BoardMember & {
  membershipId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  access: 'EDIT' | 'COMMENT' | 'VIEW';
};

export type BoardSubtask = {
  id: string;
  text: string;
  done: boolean;
  order: number;
};

export type BoardComment = {
  id: string;
  body: string;
  createdAt: Date;
  author: BoardMember;
};

export type BoardCardData = {
  id: string;
  title: string;
  code: string;
  description?: string | null;
  dueDate: Date | null;
  /** The zone the due date was set in. Absent means it is a calendar day. */
  dueTimeZone?: string | null;
  comments?: BoardComment[];
  subtasks?: BoardSubtask[];
  assignees?: BoardMember[];
  label?: { id: string; name: string; tone: LabelTone } | null;
};

export type BoardColumnData = {
  id: string;
  title: string;
  order: number;
  cards: BoardCardData[];
};
