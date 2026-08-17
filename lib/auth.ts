export function usernameToInternalEmail(username: string) {
  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(normalized)) throw new Error("INVALID_USERNAME");
  const domain = process.env.INTERNAL_AUTH_EMAIL_DOMAIN || "field.internal";
  return `${normalized}@${domain}`;
}
