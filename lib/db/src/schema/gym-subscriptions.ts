import { pgTable, text, serial, timestamp, bigint } from "drizzle-orm/pg-core";

export const gymSubscriptionsTable = pgTable("gym_subscriptions", {
  id: serial("id").primaryKey(),
  gymId: bigint("gym_id", { mode: "number" }).notNull(),
  plan: text("plan").notNull().default("1month"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GymSubscription = typeof gymSubscriptionsTable.$inferSelect;
