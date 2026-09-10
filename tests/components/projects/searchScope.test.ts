// tests/components/projects/searchScope.test.ts
//
// Tests for the pathname-to-search-scope mapping used by the shell search
// provider so a query belongs to a screen, not the chrome.
//
// Tested:
// - /projects, /tasks, /archived, and each board / project-archived route
//   get distinct scopes
// - /account has no scope
// - Trailing slashes do not change the scope
//
// What is covered:
// - Screen identity for the search map. jsdom cannot prove a real Next
//   navigation keeps the provider mounted.
//
// Run with: pnpm test:run tests/components/projects/searchScope.test.ts
//
// SEE: src/components/projects/searchScope.ts

import { describe, it, expect } from 'vitest';

import { searchScopeForPath } from '@/components/projects/searchScope';

describe('searchScopeForPath', () => {
  it('gives /projects its own scope', () => {
    expect(searchScopeForPath('/projects')).toBe('projects');
    expect(searchScopeForPath('/projects/')).toBe('projects');
  });

  it('gives each project board its own scope', () => {
    expect(searchScopeForPath('/projects/project-1')).toBe('board:project-1');
    expect(searchScopeForPath('/projects/project-2')).toBe('board:project-2');
  });

  it('gives project archived tasks a scope distinct from that board', () => {
    expect(searchScopeForPath('/projects/project-1/archived')).toBe('project-archived:project-1');
  });

  it('gives /tasks and /archived their own scopes', () => {
    expect(searchScopeForPath('/tasks')).toBe('tasks');
    expect(searchScopeForPath('/archived')).toBe('archived');
  });

  it('gives /account no scope so it cannot hold a query', () => {
    expect(searchScopeForPath('/account')).toBeNull();
    expect(searchScopeForPath('/account/')).toBeNull();
    expect(searchScopeForPath('/account/settings')).toBeNull();
  });
});
