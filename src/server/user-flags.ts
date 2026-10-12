import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * The user's status, role and AI pause, read fresh (never from the 5-minute session cache) so a
 * block, role change or pause applies on the next request. One query, shared by `requireUser`,
 * `roleOf` and the AI quota within a request (React cache) — each page used to read them one
 * after another.
 */
export const freshUserFlags = cache((userId: string) =>
  prisma.user.findUnique({ where: { id: userId }, select: { status: true, role: true, aiPaused: true } }),
);
