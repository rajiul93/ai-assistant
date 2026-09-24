import { redirect } from "next/navigation";

/** Revisions now live in the Tasks page's "Revisions" tab; keep old links working. */
export default function RevisionsPage() {
  redirect("/tasks?view=revisions");
}
