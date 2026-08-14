/** Two uppercase letters from a display name, falling back to username. */
export function initials(name: string, username = ''): string {
  const fromName = lettersFrom(name);
  if (fromName) return fromName;
  return lettersFrom(username, { firstTwoOnly: true });
}

function lettersFrom(value: string, options?: { firstTwoOnly?: boolean }): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';

  if (!options?.firstTwoOnly && words.length >= 2) {
    const first = firstChars(words[0]!, 1);
    const last = firstChars(words[words.length - 1]!, 1);
    return `${first}${last}`.toUpperCase();
  }

  return firstChars(words[0]!, 2).toUpperCase();
}

function firstChars(value: string, count: number): string {
  return [...value].slice(0, count).join('');
}
