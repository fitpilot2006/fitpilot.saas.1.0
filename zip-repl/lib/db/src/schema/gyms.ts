import { pgTable, text, bigserial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gymsTable = pgTable("gyms", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull().default("My Gym"),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("starter"),
  status: text("status").notNull().default("active"),
  memberJoinCode: text("member_join_code").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGymSchema = createInsertSchema(gymsTable).omit({ id: true, createdAt: true });
export type InsertGym = z.infer<typeof insertGymSchema>;
export type Gym = typeof gymsTable.$inferSelect;
