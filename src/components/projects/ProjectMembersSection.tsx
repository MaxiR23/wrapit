'use client';

import { useState } from 'react';

import { createInvitation } from '@/actions/createInvitation';
import { shellFocusClassName } from '@/components/projects/shell';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { initials } from '@/lib/initials';
import { CANT_INVITE_USER_MESSAGE } from '@/lib/messages';
import { cn } from '@/lib/utils';

export type ProjectMemberView = {
  userId: string;
  name: string;
  username: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
};

const ROLE_LABEL: Record<ProjectMemberView['role'], string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
};

export default function ProjectMembersSection({
  projectId,
  members,
}: {
  projectId: string;
  members: ProjectMemberView[];
}) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onInvite() {
    const trimmed = username.trim();
    if (!trimmed) return;
    setPending(true);
    setError(null);
    const result = await createInvitation({ projectId, username: trimmed });
    setPending(false);
    if ('error' in result) {
      setError(result.error === 'Unauthorized' ? result.error : CANT_INVITE_USER_MESSAGE);
      return;
    }
    setUsername('');
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Members</h2>
      <ul className="flex flex-col gap-3">
        {members.map((member) => (
          <li key={member.userId} className="flex items-center gap-3">
            <span
              className="inline-flex size-8 items-center justify-center rounded-full border border-border-strong bg-card text-[11px] font-semibold leading-none"
              aria-hidden="true"
            >
              {initials(member.name, member.username)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{member.name}</span>
              <span className="block text-xs text-muted-foreground">{ROLE_LABEL[member.role]}</span>
            </span>
          </li>
        ))}
      </ul>

      <Field className="max-w-sm gap-[7px]">
        <FieldLabel htmlFor="invite-username" className="text-xs font-medium text-muted-foreground">
          Invite by username
        </FieldLabel>
        <div className="flex gap-2">
          <Input
            id="invite-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="off"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'invite-username-error' : undefined}
            className="h-[38px] rounded-md bg-background px-3 text-[13.5px]"
          />
          <Button
            type="button"
            disabled={pending || username.trim().length === 0}
            onClick={() => void onInvite()}
            className={cn(shellFocusClassName, 'h-[38px]')}
          >
            Invite
          </Button>
        </div>
        {error ? <FieldError id="invite-username-error">{error}</FieldError> : null}
      </Field>
    </section>
  );
}
