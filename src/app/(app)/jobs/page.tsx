import { ApplicationBoard } from "@/components/jobs/application-board";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function JobsPage() {
  const user = await requireUser();
  const applications = await prisma.jobApplication.findMany({
    where: { userId: user.id },
    orderBy: [{ updatedAt: "desc" }],
  });
  return <ApplicationBoard initialApplications={applications} />;
}
