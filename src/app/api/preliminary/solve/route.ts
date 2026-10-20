import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanSolution, stripCitations } from "@/lib/solution-html";
import { checkAi } from "@/server/ai-access";
import { premiumForSet } from "@/server/premium";
import { SOLVE_PER_CALL, writeSolutions, writtenSolutionsSchema } from "@/server/solution-writer";

/**
 * Like the Question Bank's AI solutions, for the user's own Preliminary set (owner, 2026-10-19).
 * Up to SOLVE_PER_CALL questions a call, so the instructions are paid once.
 */
export const maxDuration = 120;

const requestSchema = z.object({
  setId: z.string().min(1).max(64),
  questionIds: z.array(z.string().min(1).max(64)).min(1).max(SOLVE_PER_CALL),
  /** "missing": fill only an empty solution/explanation; "all": write both again. */
  fill: z.enum(["missing", "all"]),
});

type Notes = { id: string; solution: string | null; explanation: string | null };

/**
 * Writes a solution and an explanation for questions of the user's own set. The questions, their
 * options and the right answers are sent but never changed. Solutions are a paid feature, so the
 * set must be one whose solutions the user may see, and each question counts toward the plan's
 * daily AI suggestions (once a day per question). Never during a test: it would show the answer.
 */
export async function POST(request: Request) {
  const user = await requireUser();
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "কোন প্রশ্ন, বোঝা গেল না।" }, { status: 400 });
  const { setId, questionIds, fill } = parsed.data;

  const set = await prisma.questionSet.findFirst({ where: { id: setId, userId: user.id }, select: { id: true, status: true, bankSetId: true, subject: { select: { name: true } }, topicName: true } });
  if (!set) return Response.json({ error: "Set পাওয়া যায়নি।" }, { status: 404 });
  if (set.status === "TESTING") return Response.json({ error: "Test চলার সময় সমাধান লেখা যায় না।" }, { status: 409 });
  if (!(await premiumForSet(user, set.bankSetId))) return Response.json({ error: "সমাধান আর ব্যাখ্যা প্ল্যান নিলে পাওয়া যায়।" }, { status: 403 });

  const found = await prisma.question.findMany({ where: { id: { in: questionIds }, setId: set.id }, select: { id: true, text: true, options: true, correctIndex: true, solution: true, explanation: true } });
  const wanted = fill === "all" ? found : found.filter((question) => !question.solution?.trim() || !question.explanation?.trim());
  if (!wanted.length) return Response.json({ results: [], originals: [] });

  // Each question counts once a day toward the plan's AI suggestions; stop at the limit.
  const allowed: typeof wanted = [];
  for (const question of wanted) {
    const { blocked } = await checkAi(user, "suggestion", `prelim-solve:${question.id}`);
    if (blocked) {
      if (!allowed.length) return Response.json({ error: blocked === "daily" ? "আজকের AI ব্যবহারের সীমা শেষ।" : "AI এখন ব্যবহার করা যাচ্ছে না।" }, { status: 403 });
      break;
    }
    allowed.push(question);
  }

  const subject = [set.subject?.name, set.topicName].filter(Boolean).join(" › ");
  const raw = await writeSolutions(allowed.map((question) => ({ id: question.id, subject, question: question.text, options: question.options, correctOption: question.correctIndex + 1 })), user.id, "prelim_solve");
  if (!raw) return Response.json({ error: "AI এই মুহূর্তে উত্তর দিতে পারল না। একটু পরে আবার চেষ্টা করো।" }, { status: 502 });

  let written: z.infer<typeof writtenSolutionsSchema>["questions"];
  try {
    written = writtenSolutionsSchema.parse(JSON.parse(raw)).questions;
  } catch {
    return Response.json({ error: "AI-এর উত্তর বোঝা গেল না।" }, { status: 502 });
  }

  const keep = (current: string | null, next: string) => (fill === "missing" && current?.trim() ? current : cleanSolution(stripCitations(next)) ?? current);
  const results: Notes[] = [];
  const originals: Notes[] = [];
  for (const question of allowed) {
    const item = written.find((entry) => entry.id === question.id);
    if (!item) continue;
    results.push({ id: question.id, solution: keep(question.solution, item.solution), explanation: keep(question.explanation, item.explanation) });
    // The originals come back too, so the page can undo the run.
    originals.push({ id: question.id, solution: question.solution, explanation: question.explanation });
  }
  await prisma.$transaction(results.map(({ id, solution, explanation }) => prisma.question.update({ where: { id }, data: { solution, explanation } })));
  return Response.json({ results, originals });
}
