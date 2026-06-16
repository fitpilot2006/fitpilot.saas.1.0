import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const aiWorkoutPlansTable = pgTable("ai_workout_plans", {
  id: serial("id").primaryKey(),
  gymId: integer("gym_id").notNull(),
  memberId: integer("member_id").notNull(),
  memberName: text("member_name"),
  age: integer("age"),
  gender: text("gender"),
  weightVal: text("weight_val"),
  heightVal: text("height_val"),
  fitnessLevel: text("fitness_level"),
  goal: text("goal"),
  trainingDays: integer("training_days"),
  plan: jsonb("plan").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type AiWorkoutPlan = typeof aiWorkoutPlansTable.$inferSelect;
