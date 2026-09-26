/** Always admins, whatever ADMIN_EMAILS says. */
const OWNER_ADMINS = ["riazahmed.tex@gmail.com", "rajiulrayhan@gmail.com"];

/**
 * Admins see every user's AI usage and decide who may use the AI; everyone else sees only their
 * own usage. Server-only: reads a private env var (ADMIN_EMAILS, comma-separated) for extra admins.
 */
export function isAdmin(email: string | null | undefined) {
  if (!email) return false;
  const admins = [...OWNER_ADMINS, ...(process.env.ADMIN_EMAILS ?? "").split(",")].map((item) => item.trim().toLowerCase()).filter(Boolean);
  return admins.includes(email.toLowerCase());
}
