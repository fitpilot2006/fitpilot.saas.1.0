import { pgTable, text, serial, timestamp, integer, bigint } from "drizzle-orm/pg-core";

export const membersTable = pgTable("members", {
  id: serial("id").primaryKey(),
  gymId: bigint("gym_id", { mode: "number" }).notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  membershipType: text("membership_type").notNull().default("basic"),
  membershipExpiry: text("membership_expiry").notNull(),
  status: text("status").notNull().default("active"),
  memberCode: text("member_code"),
  workoutPlanId: integer("workout_plan_id"),
  notes: text("notes"),
  photoUrl: text("photo_url"),
  qrToken: text("qr_token"),
  emergencyContact: text("emergency_contact"),
  address: text("address"),
  dateOfBirth: text("date_of_birth"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Member = typeof membersTable.$inferSelect;
