import { pgTable, text, bigserial, timestamp, integer } from "drizzle-orm/pg-core";

export const gymsTable = pgTable("gyms", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull().default("My Gym"),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("starter"),
  status: text("status").notNull().default("active"),
  memberJoinCode: text("member_join_code").unique(),
  memberLimit: integer("member_limit"),
  subscriptionExpiry: text("subscription_expiry"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Gym = typeof gymsTable.$inferSelect;
