import { pgTable, text, bigserial, bigint, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gymUsersTable = pgTable("gym_users", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  gymId: bigint("gym_id", { mode: "number" }).notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull().default(""),
  role: text("role").notNull().default("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGymUserSchema = createInsertSchema(gymUsersTable).omit({ id: true, createdAt: true });
export type InsertGymUser = z.infer<typeof insertGymUserSchema>;
export type GymUser = typeof gymUsersTable.$inferSelect;
