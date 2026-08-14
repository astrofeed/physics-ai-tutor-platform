import "dotenv/config";
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { loginAndGoto, TEST_STUDENT_EMAIL } from "./helpers";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const CONVERSATION_TITLE = "Scroll behaviour fixture";

test.beforeAll(async () => {
  const student = await prisma.user.findUniqueOrThrow({
    where: { email: TEST_STUDENT_EMAIL },
  });

  await prisma.conversation.deleteMany({
    where: { userId: student.id, title: CONVERSATION_TITLE },
  });

  await prisma.conversation.create({
    data: {
      userId: student.id,
      title: CONVERSATION_TITLE,
      messages: {
        create: Array.from({ length: 40 }, (_, i) => ({
          role: i % 2 === 0 ? "user" : "assistant",
          content: `Message ${i + 1} — ${"filler ".repeat(30)}`,
        })),
      },
    },
  });
});

test.afterAll(async () => {
  await prisma.conversation.deleteMany({ where: { title: CONVERSATION_TITLE } });
  await prisma.$disconnect();
});

test.describe("Chat scroll position", () => {
  test("opens at the latest message and offers a jump back to it", async ({ page }) => {
    await loginAndGoto(page, TEST_STUDENT_EMAIL, "/chat");
    await page.getByText(CONVERSATION_TITLE).first().click();
    await expect(page.getByText("Message 40")).toBeVisible();

    const container = page.locator("#chat-print-area");
    const jumpToLatest = page.getByRole("button", { name: "Jump to latest" });

    const distanceFromBottom = () =>
      container.evaluate(
        (el) => el.scrollHeight - el.scrollTop - el.clientHeight
      );

    expect(await distanceFromBottom()).toBeLessThan(80);
    await expect(jumpToLatest).toBeHidden();

    await container.evaluate((el) => el.scrollTo({ top: 0 }));
    await expect(jumpToLatest).toBeVisible();
    expect(await distanceFromBottom()).toBeGreaterThan(80);

    await jumpToLatest.click();
    await expect(jumpToLatest).toBeHidden();
    await expect.poll(distanceFromBottom).toBeLessThan(80);
  });
});
