import { redirect } from "next/navigation";

/** The study timer now lives on the Tasks page and in the session bar; keep old links working. */
export default function TimerPage() {
  redirect("/tasks");
}
