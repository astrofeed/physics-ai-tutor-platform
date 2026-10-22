import { spawnSync } from "node:child_process";
import { test, expect } from "@playwright/test";

function composeConfig(overrides: Record<string, string> = {}) {
  return spawnSync("docker", [
    "compose", "--env-file", "/dev/null", "-f", "docker-compose.yml",
    "config", "--format", "json",
  ], {
    encoding: "utf8",
    env: {
      ...process.env,
      POSTGRES_PASSWORD: "config-test-admin",
      POSTGRES_APP_PASSWORD: "config-test-app",
      ...overrides,
    },
  });
}

test("local Postgres uses a patched image, loopback binding and SCRAM auth", () => {
  const result = composeConfig();
  expect(result.status, result.stderr).toBe(0);
  const config: unknown = JSON.parse(result.stdout);
  expect(config).toMatchObject({
    services: {
      db: {
        image: "postgres:16.15-alpine",
        ports: [expect.objectContaining({ host_ip: "127.0.0.1", target: 5432 })],
        environment: {
          POSTGRES_PASSWORD: "config-test-admin",
          POSTGRES_APP_PASSWORD: "config-test-app",
          POSTGRES_HOST_AUTH_METHOD: "scram-sha-256",
          POSTGRES_INITDB_ARGS: "--auth-host=scram-sha-256 --auth-local=scram-sha-256",
        },
        volumes: expect.arrayContaining([
          expect.objectContaining({
            target: "/docker-entrypoint-initdb.d/10-app-role.sql",
            read_only: true,
          }),
        ]),
      },
    },
  });
});

for (const variable of ["POSTGRES_PASSWORD", "POSTGRES_APP_PASSWORD"]) {
  test(`local Postgres refuses an empty ${variable}`, () => {
    const result = composeConfig({ [variable]: "" });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(variable);
  });
}
