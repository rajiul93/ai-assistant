import { z } from "zod";

export const taskStatusSchema = z.enum([
  "NOT_STARTED",
  "IN_PROGRESS",
  "FINISHED",
  "REVISION",
]);

export const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const taskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  subjectId: z.string().optional().or(z.literal("")),
  topicId: z.string().optional().or(z.literal("")),
  estimatedMinutes: z.coerce.number().int().min(1).max(24 * 60),
  dueDate: z.string().optional().or(z.literal("")),
  priority: taskPrioritySchema,
  status: taskStatusSchema,
});

export const subjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
});

export const topicSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  subjectId: z.string().min(1),
  parentId: z.string().optional().or(z.literal("")),
});

export const studyPlanSchema = z.object({
  longTermDeadline: z.string().min(1, "Long-term deadline is required"),
  preparationDeadline: z.string().min(1, "Preparation deadline is required"),
  dailyStudyTargetHours: z.coerce.number().min(0.5).max(16),
  dateOfBirth: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || new Date(value) < new Date(), "Date of birth must be in the past"),
  ageLimitYears: z.coerce.number().int().min(1, "Age limit must be at least 1").max(100),
});

export const revisionSchema = z.object({
  topicId: z.string().min(1),
  revisionDate: z.string().min(1),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const studySessionSchema = z.object({
  subjectId: z.string().optional().or(z.literal("")),
  topicId: z.string().optional().or(z.literal("")),
  startedAt: z.string().min(1),
  endedAt: z.string().min(1),
  durationSeconds: z.coerce.number().int().min(1),
});

export type TaskInput = z.infer<typeof taskSchema>;
export type StudyPlanInput = z.infer<typeof studyPlanSchema>;
