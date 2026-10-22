import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const allowedOptions = new Set(["sslmode", "sslaccept", "channel_binding", "connect_timeout", "schema"]);
const maxOutputBytes = 8 * 1024 * 1024;

function parseConnection() {
  const raw = process.env.MIGRATION_DATABASE_URL;
  if (!raw) throw new Error("MIGRATION_DATABASE_URL must be supplied explicitly; no fallback is allowed.");
  let url;
  try {
    url = new URL(raw);
    decodeURIComponent(url.password);
  } catch {
    throw new Error("MIGRATION_DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname ||
      !url.username || !url.password || !/^\/[^/]+$/.test(url.pathname) || url.hash) {
    throw new Error("A PostgreSQL URL with credentials, host and database is required.");
  }
  return { raw, url };
}

function validateDirectConnection(url) {
  const options = [...url.searchParams.keys()];
  if (options.some((key) => !allowedOptions.has(key)) ||
      new Set(options).size !== options.length ||
      (url.searchParams.get("schema") ?? "public") !== "public" ||
      url.hostname.toLowerCase().split(".")[0].endsWith("-pooler")) {
    throw new Error("Use a direct public-schema connection without routing overrides or pooling options.");
  }
}

function approvedConnection() {
  if (["VERCEL", "VERCEL_ENV", "VERCEL_TARGET_ENV"].some((key) => process.env[key] !== undefined)) {
    throw new Error("Run database migrations outside Vercel builds and application runtimes.");
  }
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--approve-target") {
    throw new Error("Explicit confirmation required: --approve-target <host:port/database>.");
  }
  const connection = parseConnection();
  validateDirectConnection(connection.url);
  const { hostname, port, pathname } = connection.url;
  if (args[1] !== `${hostname}:${port || "5432"}${pathname}`) {
    throw new Error("--approve-target must exactly match the migration host, port and database.");
  }
  return connection;
}

function redactOutput(output, connection) {
  const secrets = [connection.raw, connection.url.password, decodeURIComponent(connection.url.password)];
  return secrets.reduce((text, secret) => text.replaceAll(secret, "[REDACTED]"), output ?? "");
}

function deployMigrations(connection) {
  const result = spawnSync(process.execPath, [
    resolve(projectRoot, "node_modules/prisma/build/index.js"),
    "migrate", "deploy", "--config", resolve(projectRoot, "prisma/deploy.config.ts"),
  ], {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: maxOutputBytes,
    env: { ...process.env, MIGRATION_DATABASE_URL: connection.url.href },
  });
  process.stdout.write(redactOutput(result.stdout, connection));
  process.stderr.write(redactOutput(result.stderr, connection));
  if (result.error) throw new Error("Unable to complete the Prisma migration process.");
  process.exitCode = result.status ?? 1;
}

try {
  deployMigrations(approvedConnection());
} catch (error) {
  process.stderr.write(`[migration] ${error.message}\n`);
  process.exitCode = 1;
}
