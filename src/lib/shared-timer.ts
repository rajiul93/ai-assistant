/** The study timer shared by a user's devices (ActiveTimer), as sent to the browser and over socket.io. */
export type SharedTimer = { startedAt: number | null; accumulatedMs: number; paused: boolean; label: string; taskId: string; subjectId: string; topicId: string; targetMinutes: number | null };
