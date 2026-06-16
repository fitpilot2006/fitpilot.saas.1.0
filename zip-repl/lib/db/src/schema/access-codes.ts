import { pgTable, text, serial, timestamp, boolean, bigint } from "drizzle-orm/pg-core";

export const accessCodesTable = pgTable("access_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  label: text("label"),
  active: boolean("active").notNull().default(true),
  used: boolean("used").notNull().default(false),
  usedAt: timestamp("used_at", { withTimezone: true }),
  usedByGymId: bigint("used_by_gym_id", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AccessCode = typeof accessCodesTable.$inferSelect;
