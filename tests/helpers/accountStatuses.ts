import type { UserStatusesView } from '@/lib/userStatus';

export const accountStatusesFixture: UserStatusesView = {
  activeStatusId: 'status-active',
  statuses: [
    {
      id: 'status-active',
      name: 'Active',
      description: 'Available for the team',
      color: 'green',
      order: 0,
    },
    {
      id: 'status-inactive',
      name: 'Inactive',
      description: 'No recent activity',
      color: 'gray',
      order: 1,
    },
    {
      id: 'status-dnd',
      name: 'Do not disturb',
      description: 'Notifications paused',
      color: 'red',
      order: 2,
    },
    {
      id: 'status-ooo',
      name: 'Out of office',
      description: 'Back on Monday',
      color: 'amber',
      order: 3,
    },
  ],
};
