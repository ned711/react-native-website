/** Player tags look like `NASSER#4827`: a display name plus a 4-digit discriminator. */
export const USERNAME_PATTERN = /^[\p{L}\p{N}_]{3,16}$/u;
const TAG_PATTERN = /^([\p{L}\p{N}_]{3,16})#(\d{4})$/u;

export interface PlayerTag {
  readonly username: string;
  readonly discriminator: string;
}

export function formatTag(tag: PlayerTag): string {
  return `${tag.username.toUpperCase()}#${tag.discriminator}`;
}

export function parseTag(input: string): PlayerTag | null {
  const match = TAG_PATTERN.exec(input.trim());
  if (!match) return null;
  const [, username, discriminator] = match;
  if (!username || !discriminator) return null;
  return {username, discriminator};
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}
