"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * The study timer shared by the user's devices (owner, 2026-10-15): one ActiveTimer row per user.
 * A device that starts a timer claims the row; if another device already has one running, that
 * one is returned instead and shown everywhere. Pause/resume update it; save or cancel deletes it.
 * Times are epoch milliseconds from the device's clock, the same values the local store keeps.
 */

export type SharedTimer = { startedAt: number | null; accumulatedMs: number; paused: boolean; label: string; taskId: string; subjectId: string; topicId: string; targetMinutes: number | null };

const timerSchema = z.object({
  startedAt: z.number().int().positive().nullable(),
  accumulatedMs: z.number().int().min(0).max(7 * 86_400_000),
  paused: z.boolean(),
  label: z.string().max(300),
  taskId: z.string().max(64),
  subjectId: z.string().max(64),
  topicId: z.string().max(64),
  targetMinutes: z.number().int().min(1).max(1440).nullable(),
});

const toShared = (row: { startedAt: Date | null; accumulatedMs: number; paused: boolean; label: string; taskId: string; subjectId: string; topicId: string; targetMinutes: number | null }): SharedTimer => ({
  startedAt: row.startedAt ? row.startedAt.getTime() : null,
  accumulatedMs: row.accumulatedMs,
  paused: row.paused,
  label: row.label,
  taskId: row.taskId,
  subjectId: row.subjectId,
  topicId: row.topicId,
  targetMinutes: row.targetMinutes,
});

const toRow = (timer: SharedTimer) => ({ ...timer, startedAt: timer.startedAt ? new Date(timer.startedAt) : null });

/** The timer running on any of this user's devices, or null. */
export async function getSharedTimer(): Promise<SharedTimer | null> {
  const user = await requireUser();
  const row = await prisma.activeTimer.findUnique({ where: { userId: user.id } });
  return row ? toShared(row) : null;
}

/** Start: claims the shared timer, unless one is already running — then that one comes back. */
export async function claimSharedTimer(input: unknown): Promise<{ ok: true } | { ok: false; active: SharedTimer }> {
  const user = await requireUser();
  const timer = timerSchema.parse(input);
  const existing = await prisma.activeTimer.findUnique({ where: { userId: user.id } });
  if (existing) return { ok: false, active: toShared(existing) };
  try {
    await prisma.activeTimer.create({ data: { userId: user.id, ...toRow(timer) } });
    return { ok: true };
  } catch {
    // Two devices started at the same moment: the other one won.
    const winner = await prisma.activeTimer.findUnique({ where: { userId: user.id } });
    if (winner) return { ok: false, active: toShared(winner) };
    throw new Error("টাইমার চালু করা গেল না।");
  }
}

/** Pause or resume: keeps the shared row in step (no-op if it was stopped elsewhere). */
export async function updateSharedTimer(input: unknown) {
  const user = await requireUser();
  const timer = timerSchema.parse(input);
  const result = await prisma.activeTimer.updateMany({ where: { userId: user.id }, data: toRow(timer) });
  return result.count > 0;
}

/** Save or cancel: ends the shared timer. False when another device had already ended it. */
export async function finishSharedTimer() {
  const user = await requireUser();
  const result = await prisma.activeTimer.deleteMany({ where: { userId: user.id } });
  return result.count > 0;
}
