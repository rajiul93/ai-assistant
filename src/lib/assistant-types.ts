export type ChatMessage = { role: "user" | "assistant"; text: string };

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export type TaskDraft = {
  title: string;
  description: string;
  subjectId: string;
  subjectName: string;
  /** ISO timestamp in the app timezone, or "" for no due date. */
  dueDate: string;
  dueLabel: string;
  priority: TaskPriority;
  estimatedMinutes: number;
};

/** A change the assistant has prepared and will only make after the user confirms it. */
export type PendingAction =
  | { kind: "create_task"; draft: TaskDraft }
  | { kind: "complete_task"; taskId: string; title: string; subjectName: string }
  | { kind: "add_revision"; topicId: string; topicName: string; subjectName: string; revisionDate: string; dateLabel: string; notes: string };

/** Starting the timer saves nothing, so it runs right away instead of asking first. */
export type TimerStart = { minutes: number | null; subjectId: string; subjectName: string; topicId: string; topicName: string };

/** "ai" when Gemini understood the request, "fallback" when simple keyword rules had to answer. */
export type ReplySource = "ai" | "fallback";

export type AssistantReply = (
  | { type: "answer" | "clarify"; reply: string }
  | { type: "navigate"; reply: string; href: string }
  | { type: "confirm"; reply: string; action: PendingAction }
  | { type: "start_timer"; reply: string; timer: TimerStart }
) & { source?: ReplySource };

export type AssistantRequest = {
  message: string;
  history?: ChatMessage[];
  /** The action currently waiting for confirmation, so the user can amend it by voice. */
  pending?: PendingAction | null;
  /** The reply will be spoken aloud, so keep it short and conversational. */
  voice?: boolean;
  /** Other ways speech recognition heard the same sentence, to recover from mishearing. */
  alternatives?: string[];
  lang?: "bn" | "en";
};

export const assistantPages = {
  dashboard: "/dashboard",
  tasks: "/tasks",
  new_task: "/tasks?add=1",
  subjects: "/subjects",
  revisions: "/revisions",
  progress: "/progress",
  timer: "/timer",
  plan: "/plan",
} as const;

export type AssistantPage = keyof typeof assistantPages;
