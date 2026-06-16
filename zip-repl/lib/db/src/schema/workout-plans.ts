import { pgTable, text, serial, timestamp, integer, jsonb, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const workoutPlansTable = pgTable("workout_plans", {
  id: serial("id").primaryKey(),
  gymId: bigint("gym_id", { mode: "number" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  level: text("level").notNull().default("beginner"),
  durationWeeks: integer("duration_weeks").notNull().default(4),
  exercises: jsonb("exercises").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertWorkoutPlanSchema = createInsertSchema(workoutPlansTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWorkoutPlan = z.infer<typeof insertWorkoutPlanSchema>;
export type WorkoutPlan = typeof workoutPlansTable.$inferSelect;
