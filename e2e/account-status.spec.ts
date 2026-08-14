import "dotenv/config";
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { loginAsTestUser } from "./helpers";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const EMAIL = `e2e-account-status-${Date.now()}@e2e.local`;

test.describe("API auth re-reads account state", () => {
  test.afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await prisma.$disconnect();
  });

  test("deleting or demoting an account takes effect before the JWT expires", async ({ page }) => {
    const user = await prisma.user.create({
      data: { email: EMAIL, name: "E2E Account Status", role: "TA", emailVerified: new Date() },
    });
    await loginAsTestUser(page.context(), EMAIL);

    // Staff-only endpoint while the account is an active TA
    expect((await page.request.get("/api/grading/export")).status()).toBe(200);

    await prisma.user.update({ where: { id: user.id }, data: { role: "STUDENT" } });
    expect((await page.request.get("/api/grading/export")).status()).toBe(403);

    await prisma.user.update({
      where: { id: user.id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    const afterDelete = await page.request.get("/api/assignments");
    expect(afterDelete.status()).toBe(401);
    expect((await afterDelete.json()).error).toContain("no longer active");
  });
});
