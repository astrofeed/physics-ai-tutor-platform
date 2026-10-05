import { readFileSync } from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { Client } from "pg";

const migration = readFileSync(
  path.resolve(__dirname, "../prisma/migrations/20261005230052_human_grading_comments/migration.sql"),
  "utf8"
);
const tables = ["PresentationGradingJob", "ReportGradingJob"] as const;
const cases = [
  { name: "fresh tables", existingTimestamps: 0, existingComments: 0 },
  { name: "presentation updatedAt already exists", existingTimestamps: 1, existingComments: 0 },
  { name: "both updatedAt columns already exist", existingTimestamps: 2, existingComments: 0 },
  { name: "partially applied migration", existingTimestamps: 1, existingComments: 1 },
  { name: "all columns already exist", existingTimestamps: 2, existingComments: 2 },
];

for (const scenario of cases) {
  test(`human comments migration: ${scenario.name}`, async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL search_path TO pg_temp");
      for (let index = 0; index < tables.length; index++) {
        const table = tables[index];
        await client.query(`CREATE TEMP TABLE "${table}" (id TEXT PRIMARY KEY, "humanTotal" DECIMAL(10, 2)) ON COMMIT DROP`);
        await client.query(`INSERT INTO "${table}" VALUES ('existing-grade', 85.5)`);
        if (index < scenario.existingTimestamps) {
          await client.query(`ALTER TABLE "${table}" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
          await client.query(`UPDATE "${table}" SET "updatedAt" = '2026-09-01 12:00:00'`);
        }
        if (index < scenario.existingComments) {
          await client.query(`ALTER TABLE "${table}" ADD COLUMN "humanComments" TEXT`);
          await client.query(`UPDATE "${table}" SET "humanComments" = 'Keep existing feedback'`);
        }
      }

      await client.query(migration);
      for (let index = 0; index < tables.length; index++) {
        const table = tables[index];
        const { rows } = await client.query(`SELECT id, "humanTotal", "humanComments", "updatedAt"::text AS "updatedAt" FROM "${table}"`);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
          id: "existing-grade",
          humanTotal: "85.50",
          humanComments: index < scenario.existingComments ? "Keep existing feedback" : null,
        });
        expect(rows[0].updatedAt).toBeTruthy();
        if (index < scenario.existingTimestamps) {
          expect(rows[0].updatedAt).toBe("2026-09-01 12:00:00");
        }
      }

      const before = await Promise.all(tables.map((table) => client.query(`SELECT * FROM "${table}"`)));
      await client.query(migration);
      const after = await Promise.all(tables.map((table) => client.query(`SELECT * FROM "${table}"`)));
      expect(after.map(({ rows }) => rows)).toEqual(before.map(({ rows }) => rows));
    } finally {
      await client.query("ROLLBACK");
      await client.end();
    }
  });
}
