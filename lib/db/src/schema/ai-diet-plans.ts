import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const aiDietPlansTable = pgTable("ai_diet_plans", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").notNull(),
  memberId: integer("member_id").notNull(),
  memberName: text("member_name"),
  age: integer("age"),
  gender: text("gender"),
  weightVal: text("weight_val"),
  heightVal: text("height_val"),
  goal: text("goal"),
  plan: jsonb("plan").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type AiDietPlan = typeof aiDietPlansTable.$inferSelect;
