import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { Client } from "pg";
import { test, expect } from "@playwright/test";

test.skip(process.env.RUN_POSTGRES_SECURITY_TESTS !== "true", "Requires a disposable Docker database");

const adminPassword = randomBytes(32).toString("hex");
const appPassword = randomBytes(32).toString("hex");
let containerId = "";
let port = 0;

function docker(args: string[]) {
  return execFileSync("docker", args, {
    encoding: "utf8",
    timeout: 120_000,
    env: {
      ...process.env,
      POSTGRES_PASSWORD: adminPassword,
      POSTGRES_APP_PASSWORD: appPassword,
    },
  }).trim();
}

function connection(user: "postgres" | "physics_app") {
  return {
    host: "127.0.0.1",
    port,
    database: "physics_tutor",
    user,
    password: user === "postgres" ? adminPassword : appPassword,
    connectionTimeoutMillis: 2_000,
    query_timeout: 5_000,
  };
}

async function queryAs(user: "postgres" | "physics_app", sql: string) {
  const client = new Client(connection(user));
  try {
    await client.connect();
    return (await client.query(sql)).rows;
  } finally {
    await client.end();
  }
}

test.beforeAll(async () => {
  test.setTimeout(120_000);
  containerId = docker([
    "run", "--detach", "--rm",
    "--tmpfs", "/var/lib/postgresql/data:rw",
    "--publish", "127.0.0.1::5432",
    "--env", "POSTGRES_PASSWORD", "--env", "POSTGRES_APP_PASSWORD",
    "--env", "POSTGRES_DB=physics_tutor",
    "--env", "POSTGRES_HOST_AUTH_METHOD=scram-sha-256",
    "--env", "POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256 --auth-local=scram-sha-256",
    "--mount", `type=bind,source=${path.resolve("scripts/init-local-postgres.sql")},target=/docker-entrypoint-initdb.d/10-app-role.sql,readonly`,
    "postgres:16.15-alpine",
  ]);
  port = Number(docker(["port", containerId, "5432/tcp"]).split(":").at(-1));
  await expect(async () => {
    expect(await queryAs("physics_app", "SELECT 1 AS connected")).toEqual([{ connected: 1 }]);
  }).toPass({ timeout: 45_000 });

  const adminUrl = `postgresql://postgres:${adminPassword}@127.0.0.1:${port}/physics_tutor`;
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    timeout: 60_000,
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: adminUrl, DIRECT_URL: adminUrl },
  });
  await queryAs("postgres", "CREATE TABLE security_probe (id SERIAL PRIMARY KEY, value TEXT NOT NULL)");
});

test.afterAll(() => {
  if (containerId) docker(["stop", containerId]);
});

test("patched PostgreSQL gives the runtime no administrative capabilities", async () => {
  const rows = await queryAs("physics_app", `
    SELECT current_setting('server_version_num')::int AS version,
      rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
    FROM pg_roles WHERE rolname = current_user
  `);
  expect(rows).toEqual([{
    version: 160015, rolsuper: false, rolcreatedb: false,
    rolcreaterole: false, rolreplication: false, rolbypassrls: false,
  }]);
  await expect(queryAs("physics_app", "CREATE TABLE forbidden_probe (id INT)"))
    .rejects.toMatchObject({ code: "42501" });
  await expect(queryAs("physics_app", "CREATE ROLE forbidden_role"))
    .rejects.toMatchObject({ code: "42501" });
});

test("runtime can read migrated tables and perform CRUD with sequences", async () => {
  expect(await queryAs("physics_app", 'SELECT COUNT(*)::int AS count FROM "User"')).toEqual([{ count: 0 }]);
  expect(await queryAs("physics_app", "INSERT INTO security_probe (value) VALUES ('before') RETURNING id"))
    .toEqual([{ id: 1 }]);
  expect(await queryAs("physics_app", "UPDATE security_probe SET value = 'after' RETURNING value"))
    .toEqual([{ value: "after" }]);
  expect(await queryAs("physics_app", "DELETE FROM security_probe RETURNING id")).toEqual([{ id: 1 }]);
});

test("TCP rejects a wrong password and Unix sockets require authentication", async () => {
  const client = new Client({ ...connection("physics_app"), password: "incorrect-test-password" });
  try {
    await expect(client.connect()).rejects.toMatchObject({ code: "28P01" });
  } finally {
    await client.end();
  }
  const socket = spawnSync("docker", [
    "exec", containerId, "psql", "-w", "-U", "postgres", "-d", "physics_tutor", "-c", "SELECT 1",
  ], { encoding: "utf8", timeout: 10_000 });
  expect(socket.status).not.toBe(0);
  expect(socket.stderr).toContain("no password supplied");
});
