"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { startOfDay } from "@/lib/dayjs";
import { prisma } from "@/lib/prisma";
import { applicationStatusSchema, jobApplicationSchema } from "@/lib/validations";

function revalidateJobs() {
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
}

/** Form values → database fields; dates are whole days in the app timezone. */
function toData(input: unknown) {
  const data = jobApplicationSchema.parse(input);
  const day = (value?: string) => (value ? startOfDay(value).toDate() : null);
  return {
    title: data.title,
    organization: data.organization,
    location: data.location || null,
    posts: [...new Set(data.posts)],
    sector: data.sector,
    status: data.status,
    appliedAt: day(data.appliedAt),
    deadline: day(data.deadline),
    examDate: day(data.examDate),
    reference: data.reference || null,
    link: data.link || null,
    notes: data.notes || null,
  };
}

async function ownedApplication(userId: string, applicationId: string) {
  const existing = await prisma.jobApplication.findFirst({ where: { id: applicationId, userId } });
  if (!existing) throw new Error("Application not found.");
  return existing;
}

export async function listMyApplications() {
  const user = await requireUser();
  return prisma.jobApplication.findMany({
    where: { userId: user.id },
    orderBy: [{ updatedAt: "desc" }],
  });
}

export async function createApplication(input: unknown) {
  const user = await requireUser();
  const application = await prisma.jobApplication.create({ data: { userId: user.id, ...toData(input) } });
  revalidateJobs();
  return application.id;
}

export async function updateApplication(applicationId: string, input: unknown) {
  const user = await requireUser();
  const existing = await ownedApplication(user.id, applicationId);
  await prisma.jobApplication.update({ where: { id: existing.id }, data: toData(input) });
  revalidateJobs();
}

export async function updateApplicationStatus(applicationId: string, status: string) {
  const user = await requireUser();
  const existing = await ownedApplication(user.id, applicationId);
  await prisma.jobApplication.update({ where: { id: existing.id }, data: { status: applicationStatusSchema.parse(status) } });
  revalidateJobs();
}

export async function deleteApplication(applicationId: string) {
  const user = await requireUser();
  const existing = await ownedApplication(user.id, applicationId);
  await prisma.jobApplication.delete({ where: { id: existing.id } });
  revalidateJobs();
}
