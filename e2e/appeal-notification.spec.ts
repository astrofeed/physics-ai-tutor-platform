import "dotenv/config";
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveAppealRecipients } from "../src/lib/services/appeal-notification-service";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const SUFFIX = `appeal-notify-${Date.now()}`;
const email = (local: string) => `${local}-${SUFFIX}@e2e.local`;

async function createUser(
  local: string,
  role: "STUDENT" | "TA" | "PROFESSOR" | "ADMIN",
  state: { isBanned?: boolean; isDeleted?: boolean } = {}
) {
  return prisma.user.create({
    data: {
      email: email(local),
      name: local,
      role,
      isBanned: state.isBanned ?? false,
      isDeleted: state.isDeleted ?? false,
    },
  });
}

async function createSubmission(studentId: string, gradedById: string | null) {
  const assignment = await prisma.assignment.create({
    data: {
      title: `Appeal notify ${SUFFIX}`,
      type: "QUIZ",
      totalPoints: 10,
      published: true,
      createdById: studentId,
      questions: {
        create: [{ questionText: "Q", questionType: "NUMERIC", points: 10, order: 0 }],
      },
    },
  });

  const submission = await prisma.submission.create({
    data: { assignmentId: assignment.id, userId: studentId, gradedById, totalScore: 5 },
  });

  return submission.id;
}

test.afterAll(async () => {
  await prisma.assignment.deleteMany({ where: { title: { contains: SUFFIX } } });
  await prisma.user.deleteMany({ where: { email: { contains: SUFFIX } } });
  await prisma.$disconnect();
});

test.describe("appeal notification recipients", () => {
  test("a human grader is the only recipient", async () => {
    const student = await createUser("student", "STUDENT");
    const grader = await createUser("grader", "TA");
    const submissionId = await createSubmission(student.id, grader.id);

    const { recipientIds, audience } = await resolveAppealRecipients(submissionId);

    expect(audience).toBe("grader");
    expect(recipientIds).toEqual([grader.id]);
  });

  test("without a human grader every active TA is notified, never professors or admins", async () => {
    const student = await createUser("student2", "STUDENT");
    const ta1 = await createUser("ta1", "TA");
    const ta2 = await createUser("ta2", "TA");
    const bannedTa = await createUser("ta-banned", "TA", { isBanned: true });
    const deletedTa = await createUser("ta-deleted", "TA", { isDeleted: true });
    const professor = await createUser("prof", "PROFESSOR");
    const admin = await createUser("admin", "ADMIN");
    const submissionId = await createSubmission(student.id, null);

    const { recipientIds, audience } = await resolveAppealRecipients(submissionId);

    expect(audience).toBe("all_tas");
    expect(recipientIds).toContain(ta1.id);
    expect(recipientIds).toContain(ta2.id);
    expect(recipientIds).not.toContain(bannedTa.id);
    expect(recipientIds).not.toContain(deletedTa.id);
    expect(recipientIds).not.toContain(professor.id);
    expect(recipientIds).not.toContain(admin.id);
    expect(recipientIds).not.toContain(student.id);
  });

  test("a deleted grader falls back to the TA audience", async () => {
    const student = await createUser("student3", "STUDENT");
    const grader = await createUser("grader-deleted", "PROFESSOR", { isDeleted: true });
    const ta = await createUser("ta3", "TA");
    const submissionId = await createSubmission(student.id, grader.id);

    const { recipientIds, audience } = await resolveAppealRecipients(submissionId);

    expect(audience).toBe("all_tas");
    expect(recipientIds).toContain(ta.id);
    expect(recipientIds).not.toContain(grader.id);
  });
});
