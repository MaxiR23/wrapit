/** Server-side info log. Never send `details` to the client. */
export function logInfo(event: string, details: Record<string, unknown>): void {
  console.info(event, details);
}
