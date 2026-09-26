import { ApplicationBoard } from "@/components/jobs/application-board";
import { requireUser } from "@/lib/auth";
import { listMyApplications } from "@/server/actions/applications";

export default async function JobsPage() {
  await requireUser();
  const applications = await listMyApplications();
  return <ApplicationBoard initialApplications={applications} />;
}
