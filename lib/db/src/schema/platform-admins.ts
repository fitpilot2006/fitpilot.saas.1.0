import { pgTable, text, bigserial, timestamp } from "drizzle-orm/pg-core";

export const platformAdminsTable = pgTable("platform_admins", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").default("Platform Owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlatformAdmin = typeof platformAdminsTable.$inferSelect;
