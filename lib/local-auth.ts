/**
 * Desktop auth: single local user, no cloud identity.
 * All API routes use this instead of Clerk.
 */
export const LOCAL_USER_ID = "local";

export function getLocalUserId(): string {
  return LOCAL_USER_ID;
}
