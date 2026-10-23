import "dotenv/config";
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { loginAsTestUser } from "./helpers";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const EMAIL = `e2e-account-status-${Date.now()}@e2e.local`;
const MODERATOR_EMAIL = `moderator-${EMAIL}`;
const TARGET_EMAIL = `target-${EMAIL}`;

test.describe("API auth re-reads account state", () => {
  test.afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: [EMAIL, MODERATOR_EMAIL, TARGET_EMAIL] } },
      select: { id: true },
      take: 3,
    });
    await prisma.auditLog.deleteMany({ where: { userId: { in: users.map((user) => user.id) } } });
    await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
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
      data: { isBanned: true, bannedAt: new Date() },
    });
    const afterBan = await page.request.get("/api/assignments");
    expect(afterBan.status()).toBe(403);
    expect((await afterBan.json()).error).toContain("suspended");

    await prisma.user.update({
      where: { id: user.id },
      data: { isBanned: false, bannedAt: null, isDeleted: true, deletedAt: new Date() },
    });
    const afterDelete = await page.request.get("/api/assignments");
    expect(afterDelete.status()).toBe(401);
    expect((await afterDelete.json()).error).toContain("no longer active");

    // Routes that authenticate outside requireApiAuth must reject too
    const runCode = await page.request.post("/api/run-code", {
      data: { code: "print(1)", language: "python" },
    });
    expect(runCode.status()).toBe(401);

    const uploadToken = await page.request.post("/api/upload/client", {
      data: { type: "blob.generate-client-token", payload: {} },
    });
    expect(uploadToken.status()).toBe(401);
    expect((await uploadToken.json()).error).toContain("no longer active");
  });

  test("moderation validates actions and requires a strictly higher role", async ({ page }) => {
    const moderator = await prisma.user.create({
      data: { email: MODERATOR_EMAIL, role: "TA", name: "E2E Moderator" },
    });
    const target = await prisma.user.create({
      data: { email: TARGET_EMAIL, role: "TA", name: "E2E Moderation Target" },
    });
    await loginAsTestUser(page.context(), moderator.email);
    const url = `/api/admin/users/${target.id}/moderate`;

    expect((await page.request.post(url, { data: { action: ["ban"] } })).status()).toBe(400);
    expect((await page.request.post(url, { data: { action: "ban" } })).status()).toBe(403);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).isBanned).toBe(false);

    await prisma.user.update({ where: { id: target.id }, data: { role: "PROFESSOR" } });
    expect((await page.request.post(url, { data: { action: "restrict" } })).status()).toBe(403);

    await prisma.user.update({ where: { id: target.id }, data: { role: "STUDENT" } });
    expect((await page.request.post(url, { data: { action: "ban" } })).status()).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).isBanned).toBe(true);
    expect((await page.request.post(url, { data: { action: "unban" } })).status()).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).isBanned).toBe(false);
  });
});
