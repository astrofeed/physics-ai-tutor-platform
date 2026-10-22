import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { test, expect } from "@playwright/test";

const target = "127.0.0.1:1/isolated_migration_test";
const migrationUrl = `postgresql://migration_user:encoded%40password@${target}?connect_timeout=1`;

function migrationEnvironment(overrides: Partial<NodeJS.ProcessEnv>) {
  return {
    ...process.env,
    VERCEL: undefined,
    VERCEL_ENV: undefined,
    VERCEL_TARGET_ENV: undefined,
    MIGRATION_DATABASE_URL: migrationUrl,
    DATABASE_URL: migrationUrl,
    DIRECT_URL: migrationUrl,
    DATABASE_URL_UNPOOLED: migrationUrl,
    ...overrides,
  };
}

function runMigration(overrides: Partial<NodeJS.ProcessEnv> = {}, args = ["--approve-target", target]) {
  return spawnSync(process.execPath, ["scripts/deploy-migrations.mjs", ...args], {
    encoding: "utf8", timeout: 20_000, env: migrationEnvironment(overrides),
  });
}

function expectRefusal(result: ReturnType<typeof runMigration>, message: string) {
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(message);
  expect(result.stdout).not.toContain("Datasource");
  expect(result.stdout + result.stderr).not.toContain("encoded%40password");
  expect(result.stdout + result.stderr).not.toContain("encoded@password");
}

test("Vercel builds only generate the client and build the application", () => {
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
  const { scripts } = JSON.parse(readFileSync("package.json", "utf8"));
  expect(vercel.buildCommand).toBe("npm run build");
  expect(scripts.build).toBe("prisma generate && next build");
  expect(scripts.postinstall).toBe("prisma generate");
  expect(scripts["db:migrate:deploy"]).toBe("node scripts/deploy-migrations.mjs");
  for (const hook of ["preinstall", "install", "prepare", "prebuild", "postbuild"]) {
    expect(scripts[hook]).toBeUndefined();
  }
});

test("migration cannot fall back to runtime or legacy administrator URLs", () => {
  expectRefusal(runMigration({ MIGRATION_DATABASE_URL: undefined }), "MIGRATION_DATABASE_URL");
});

for (const variable of ["VERCEL", "VERCEL_ENV", "VERCEL_TARGET_ENV"]) {
  test(`migration refuses the ${variable} environment`, () => {
    expectRefusal(runMigration({ [variable]: "preview" }), "outside Vercel");
  });
}

for (const args of [
  [],
  ["--approve-target", "localhost:1/isolated_migration_test"],
  ["--approve-target", "127.0.0.1:2/isolated_migration_test"],
  ["--approve-target", "127.0.0.1:1/another_database"],
  ["--approve-target", target, "--schema", "another.prisma"],
]) {
  test(`migration requires exact target approval: ${JSON.stringify(args)}`, () => {
    expectRefusal(runMigration({}, args), "--approve-target");
  });
}

for (const [name, connection] of [
  ["malformed URL", "not-a-url-encoded%40password"],
  ["wrong protocol", `https://migration_user:encoded%40password@${target}`],
  ["missing password", `postgresql://migration_user@${target}`],
  ["missing database", "postgresql://migration_user:encoded%40password@127.0.0.1:1/"],
]) {
  test(`migration rejects ${name}`, () => {
    expectRefusal(runMigration({ MIGRATION_DATABASE_URL: connection }), "PostgreSQL URL");
  });
}

for (const option of [
  "host=another.invalid",
  "dbname=another_database",
  "options=-csearch_path%3Danother_schema",
  "schema=another_schema",
  "schema=public&schema=another_schema",
  "pgbouncer=true",
]) {
  test(`migration rejects ambiguous routing or pooling: ${option}`, () => {
    expectRefusal(runMigration({ MIGRATION_DATABASE_URL: `${migrationUrl}&${option}` }), "direct public-schema");
  });
}

for (const hostname of ["ep-example-pooler.invalid", "EP-EXAMPLE-POOLER.invalid"]) {
  test(`migration rejects Neon pooler endpoint ${hostname}`, () => {
    expectRefusal(runMigration({
      MIGRATION_DATABASE_URL: `postgresql://migration_user:encoded%40password@${hostname}/neondb`,
    }), "direct public-schema");
  });
}

test("Prisma failure stays nonzero and does not expose credentials", () => {
  const result = runMigration();
  expect(result.status).toBe(1);
  expect(result.stdout + result.stderr).toContain("P1001");
  expect(result.stdout + result.stderr).not.toContain("encoded%40password");
  expect(result.stdout + result.stderr).not.toContain("encoded@password");
});

function createFailingPrismaFixture() {
  const root = test.info().outputPath("migration-runner");
  mkdirSync(resolve(root, "scripts"), { recursive: true });
  mkdirSync(resolve(root, "node_modules/prisma/build"), { recursive: true });
  const runner = resolve(root, "scripts/deploy-migrations.mjs");
  copyFileSync("scripts/deploy-migrations.mjs", runner);
  writeFileSync(resolve(root, "node_modules/prisma/build/index.js"), `
    const connection = process.env.MIGRATION_DATABASE_URL;
    process.stdout.write(JSON.stringify(process.argv.slice(2)) + "\\n" + connection);
    process.stderr.write(new URL(connection).password + "\\n" + decodeURIComponent(new URL(connection).password));
    process.exitCode = 7;
  `);
  return runner;
}

test("child output is redacted and its failure status is preserved", () => {
  const result = spawnSync(process.execPath, [createFailingPrismaFixture(), "--approve-target", target], {
    encoding: "utf8", timeout: 20_000, env: migrationEnvironment({}),
  });
  expect(result.status).toBe(7);
  expect(result.stdout).toContain('["migrate","deploy","--config"');
  expect(result.stdout).toContain("[REDACTED]");
  expect(result.stderr).toBe("[REDACTED]\n[REDACTED]");
  expect(result.stdout + result.stderr).not.toContain(migrationUrl);
});
