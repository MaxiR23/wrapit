import type { LabelTone } from '@/lib/labelTones';

export type BoardMember = {
  id: string;
  name: string;
  username: string;
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
