---
name: Drizzle relational API broken on Supabase pooler
description: Drizzle's db.query.* relational API silently returns null for all queries against the Supabase transaction-mode pooler (port 6543). Use db.select() instead.
---

## The Rule
Never use `db.query.TABLE.findFirst()` or `db.query.TABLE.findMany()`. Always use `db.select().from(TABLE).where(...).limit(1)` for single rows and `db.select().from(TABLE).where(...)` for multiple rows.

**Why:** The Supabase transaction-mode pooler (port 6543, PgBouncer) causes Drizzle's relational API (`db.query.*`) to silently return `null`/`undefined` for every query — no error is thrown. This was confirmed by timing: login with a real email took only 49–71ms (same as fake email), meaning bcrypt never ran because the user lookup returned null. After switching to `db.select()`, login correctly took ~270ms (bcrypt ran).

**How to apply:** Any time you write a DB read query in this codebase, use the query builder API:
- Single row: `const [row] = await db.select().from(table).where(eq(table.col, val)).limit(1);`
- Multiple rows: `const rows = await db.select().from(table).where(eq(table.col, val)).orderBy(desc(table.createdAt));`
- Count/aggregate: use `db.select({ count: sql... })` pattern

This applies to ALL route files. The entire codebase was migrated from `db.query.*` to `db.select()` in June 2026.
