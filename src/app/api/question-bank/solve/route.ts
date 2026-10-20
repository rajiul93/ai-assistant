import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanSolution, stripCitations } from "@/lib/solution-html";
import { checkAi } from "@/server/ai-access";
import { can } from "@/server/roles";
import { SOLVE_PER_CALL, writeSolutions, writtenSolutionsSchema } from "@/server/solution-writer";

/** Up to SOLVE_PER_CALL questions a call, so the instructions are paid once (owner, 2026-10-19). */
export const maxDuration = 120;

const requestSchema = z.object({
  questionIds: z.array(z.string().min(1).max(64)).min(1).max(SOLVE_PER_CALL),
  /** "missing": fill only an empty solution/explanation; "all": write both again. */
  fill: z.enum(["missing", "all"]),
});

/**
 * Writes a solution and an explanation for Question Bank questions with AI, for admins. The
 * question, its options and the right answer are sent but never changed; with `fill: "missing"`
 * a solution or explanation that is already there is kept as it is.
 */
export async function POST(request: Request) {
  const user = await requireUser();
  if (!(await can(user, "question_bank"))) return Response.json({ error: "এটা করতে প্রশ্ন ব্যাংক permission লাগবে।" }, { status: 403 });
  const { blocked } = await checkAi(user, "suggestion");
  if (blocked) return Response.json({ error: "AI এখন ব্যবহার করা যাচ্ছে না।" }, { status: 403 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "কোন প্রশ্ন, বোঝা গেল না।" }, { status: 400 });
  const { questionIds, fill } = parsed.data;

  const originals = await prisma.bankQuestion.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, text: true, options: true, correctIndex: true, solution: true, explanation: true, set: { select: { section: true } }, chapter: { select: { name: true, subject: { select: { name: true } } } } },
  });
  const wanted = fill === "all" ? originals : originals.filter((question) => !question.solution?.trim() || !question.explanation?.trim());
  if (!wanted.length) return Response.json({ results: [], skipped: 0, originals: [] });

  const input = wanted.map(({ id, text, options, correctIndex, set, chapter }) => ({ id, subject: set?.section ?? (chapter ? `${chapter.subject.name} › ${chapter.name}` : ""), question: text, options, correctOption: correctIndex + 1 }));
  const raw = await writeSolutions(input, user.id, "bank_solve");
  if (!raw) return Response.json({ error: "AI এই মুহূর্তে উত্তর দিতে পারল না। একটু পরে আবার চেষ্টা করো।" }, { status: 502 });

  let written: z.infer<typeof writtenSolutionsSchema>["questions"];
  try {
    written = writtenSolutionsSchema.parse(JSON.parse(raw)).questions;
  } catch {
    return Response.json({ error: "AI-এর উত্তর বোঝা গেল না।" }, { status: 502 });
  }

  const byId = new Map(wanted.map((question) => [question.id, question]));
  const results = written.flatMap((item) => {
    const original = byId.get(item.id);
    if (!original) return [];
    const keep = (current: string | null, next: string) => (fill === "missing" && current?.trim() ? current : cleanSolution(stripCitations(next)) ?? current);
    return [{ id: original.id, text: original.text, options: original.options, correctIndex: original.correctIndex, solution: keep(original.solution, item.solution), explanation: keep(original.explanation, item.explanation) }];
  });

  const now = new Date();
  await prisma.$transaction(results.map(({ id, solution, explanation }) => prisma.bankQuestion.update({ where: { id }, data: { solution, explanation, editedAt: now } })));
  // The originals come back too, so the page can undo a whole run.
  const undo = wanted.filter((question) => results.some((result) => result.id === question.id)).map(({ id, text, options, correctIndex, solution, explanation }) => ({ id, text, options, correctIndex, solution, explanation }));
  return Response.json({ results, skipped: wanted.length - results.length, originals: undo });
}
