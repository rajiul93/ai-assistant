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

export type ApplicationDraft = {
  title: string;
  organization: string;
  location: string;
  posts: string[];
  sector: "GOVERNMENT" | "NON_GOVERNMENT";
  status: "WISHLIST" | "APPLIED" | "EXAM" | "INTERVIEW" | "OFFER" | "REJECTED" | "WITHDRAWN";
  /** YYYY-MM-DD or "" */
  appliedAt: string;
  deadline: string;
  examDate: string;
  reference: string;
  link: string;
  notes: string;
};

/** A change the assistant has prepared and will only make after the user confirms it. */
export type PendingAction =
  | { kind: "create_task"; draft: TaskDraft }
  | { kind: "complete_task"; taskId: string; title: string; subjectName: string }
  /** Count one more revision of a finished task (revision lives on the task). */
  | { kind: "revise_task"; taskId: string; title: string; timesRevised: number }
  | { kind: "add_application"; draft: ApplicationDraft }
  /** content is sanitized note HTML; preview is its plain text for the card. */
  | { kind: "create_note"; title: string; content: string; preview: string };

/** Starting the timer saves nothing, so it runs right away instead of asking first. */
export type TimerStart = { minutes: number | null; subjectId: string; subjectName: string; topicId: string; topicName: string };

/** "ai" when the AI understood the request, "fallback" when simple keyword rules had to answer. */
export type ReplySource = "ai" | "fallback";

export type AssistantReply = (
  | { type: "answer" | "clarify"; reply: string }
  /** Voice only: the mic heard talk that wasn't meant for the assistant. */
  | { type: "ignore"; reply: "" }
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
  /** An image or PDF the user shared; the AI reads it together with the message. */
  attachment?: { name: string; mimeType: string; data: string } | null;
};

export const assistantPages = {
  dashboard: "/dashboard",
  tasks: "/tasks",
  new_task: "/tasks?add=1",
  subjects: "/subjects",
  revisions: "/tasks?view=revisions",
  progress: "/progress",
  timer: "/tasks",
  plan: "/plan",
  jobs: "/jobs",
  notes: "/notes",
} as const;

export type AssistantPage = keyof typeof assistantPages;
