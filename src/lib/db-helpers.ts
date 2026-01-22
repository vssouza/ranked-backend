// src/lib/db-helpers.ts
import type { Pool } from "pg"

export async function exists(
  db: Pool,
  text: string,
  values?: unknown[]
): Promise<boolean> {
  const result = values
    ? await db.query(text, values as unknown[])
    : await db.query(text)

  return result.rows.length > 0
}
