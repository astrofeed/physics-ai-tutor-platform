import "dotenv/config";
import { requireEnv } from "./load-test-env";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const STUDENT_COUNT = Number(process.env.LOAD_STUDENTS ?? 200);
const QUESTION_COUNT = 10;

export const studentEmail = (i: number) => `load-student-${i}@e2e.local`;
export const TA_EMAIL = "load-ta@e2e.local";
const LOAD_PASSWORD = requireEnv("LOAD_PASSWORD");

async function main() {
  const passwordHash = await bcrypt.hash(LOAD_PASSWORD, 10);

  const ta = await prisma.user.upsert({
    where: { email: TA_EMAIL },
    update: { passwordHash },
    create: {
      email: TA_EMAIL,
      name: "Load TA",
      role: "TA",
      emailVerified: new Date(),
      passwordHash,
    },
  });

  await prisma.user.createMany({
    data: Array.from({ length: STUDENT_COUNT }, (_, i) => ({
      email: studentEmail(i),
      name: `Load Student ${i}`,
      role: "STUDENT" as const,
      emailVerified: new Date(),
      passwordHash,
    })),
    skipDuplicates: true,
  });

  await prisma.user.updateMany({
    where: { email: { startsWith: "load-student-" } },
    data: { passwordHash },
  });

  const existing = await prisma.assignment.findFirst({ where: { title: "Load Test Quiz" } });
  if (existing) {
    await prisma.assignment.delete({ where: { id: existing.id } });
  }

  const assignment = await prisma.assignment.create({
    data: {
      title: "Load Test Quiz",
      description: "200-user concurrency test",
      type: "QUIZ",
      totalPoints: QUESTION_COUNT * 10,
      published: true,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdById: ta.id,
      questions: {
        create: Array.from({ length: QUESTION_COUNT }, (_, i) => ({
          questionText: `Question ${i + 1}: compute the net force.`,
          questionType: i % 2 === 0 ? ("NUMERIC" as const) : ("FREE_RESPONSE" as const),
          correctAnswer: i % 2 === 0 ? "9.8" : null,
          points: 10,
          order: i,
        })),
      },
    },
    include: { questions: { orderBy: { order: "asc" } } },
  });

  console.log(
    JSON.stringify({
      assignmentId: assignment.id,
      questionIds: assignment.questions.map((q) => q.id),
      students: STUDENT_COUNT,
    })
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
