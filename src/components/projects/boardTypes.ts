import type { LabelTone } from '@/lib/labelTones';

export type BoardMember = {
  id: string;
  name: string;
  username: string;
};

export type BoardCardData = {
  id: string;
  title: string;
  code: string;
  dueDate: Date | null;
  commentCount?: number;
  subtaskDone?: number;
  subtaskTotal?: number;
  assignees?: BoardMember[];
  label?: { name: string; tone: LabelTone } | null;
};

export type BoardColumnData = {
  id: string;
  title: string;
  order: number;
  cards: BoardCardData[];
};
