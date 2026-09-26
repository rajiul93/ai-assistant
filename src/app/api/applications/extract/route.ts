import { requireUser } from "@/lib/auth";
import { checkAi } from "@/server/ai-access";
import { extractApplication, extractRequestSchema } from "@/server/applications-extract";

// Reading a multi-page PDF can take a while.
export const maxDuration = 60;

/** Reads an applicant's copy (PDF/image) and returns the application form's fields, filled in. */
export async function POST(request: Request) {
  const user = await requireUser();
  const { blocked } = await checkAi(user);
  if (blocked) return Response.json({ error: blocked === "quota" ? "Your AI token limit is used up." : "You don't have AI access yet." }, { status: 403 });
  const parsed = extractRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Only images (JPG, PNG, WebP) or PDFs can be read." }, { status: 400 });
  const result = await extractApplication(parsed.data, user.id);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result.fields);
}
