/**
 * Admins (comma-separated ADMIN_EMAILS) can see every user's AI usage; everyone else sees only
 * their own. Server-only: reads a private env var.
 */
export function isAdmin(email: string | null | undefined) {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return admins.includes(email.toLowerCase());
}
